#!/usr/bin/env bash
# ============================================================================
# CI smoke test - runs against a booted local API (see .github/workflows/ci.yml).
#
# Proves the real thing works end to end on a freshly seeded database:
#   1. the public rooms feed serves seeded listings
#   2. register -> access token -> protected /auth/me
#   3. publish: the server puts it in PENDING even when the client asks for
#      ACTIVE, and it stays off the public feed while it waits
#   4. review: promote the throwaway to admin (same token - the role is read
#      live from the database), reject with a reason, resubmit, approve
#   5. only after approval is it publicly visible
#   6. pause hides it, delete removes it, foreign accounts get 403
#   7. member endpoints answer; anonymous callers get 401
#   8. the throwaway is demoted again at the end, so running this against a
#      real database leaves no admin account behind
#
# Uses node (not jq) for JSON so it runs identically on GitHub's runners and
# on a developer machine.
#
# Usage: BASE=http://127.0.0.1:4000/api/v1 bash scripts/ci/smoke.sh
# ============================================================================
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000/api/v1}"

fail() { echo "::error::$1"; exit 1; }
step() { echo ""; echo "==> $1"; }

# check <js-expression-over-`d`>  - stdin: JSON. Exit 0 when truthy.
# Uses EXPECT_ID / EXPECT_EMAIL environment variables inside expressions.
check() {
  node -e '
    const expr = process.argv[1];
    let d;
    try { d = JSON.parse(require("fs").readFileSync(0, "utf8")); }
    catch { process.exit(3); }
    let ok;
    try { ok = Boolean(eval(expr)); }
    catch { process.exit(4); }
    process.exit(ok ? 0 : 2);
  ' "$1"
}

# jval <js-expression-over-`d`>  - stdin: JSON. Prints the value.
jval() {
  node -e '
    const expr = process.argv[1];
    let d;
    try { d = JSON.parse(require("fs").readFileSync(0, "utf8")); }
    catch { process.exit(3); }
    const v = eval(expr);
    if (v === undefined || v === null) process.exit(2);
    process.stdout.write(String(v));
  ' "$1"
}

# set_role <email> <role> - writes the role straight into the database the API
# is using, through the compiled Prisma client with the pg driver adapter (the
# exact wiring the app itself uses).
#
# Doing it out-of-band is deliberate: the token issued BEFORE the promotion
# immediately gains the new role, because JwtStrategy re-reads the row on every
# request instead of trusting a claim in the token. This function therefore
# doubles as a test of that property.
set_role() {
  (
    cd apps/api
    CI_EMAIL="$1" CI_ROLE="$2" node -e '
      const { PrismaClient } = require("./dist/src/generated/prisma/client.js");
      const { PrismaPg } = require("@prisma/adapter-pg");
      const url = process.env.DATABASE_URL;
      if (!url) process.exit(2);
      const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
      prisma.user.update({
        where: { email: process.env.CI_EMAIL },
        data: { role: process.env.CI_ROLE },
      })
        .then((u) => { console.log("    " + u.email + " -> " + u.role); return prisma.$disconnect(); })
        .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
    '
  )
}

step "public feed serves the seeded rooms"
rooms="$(curl -sf "$BASE/rooms")" || fail "GET /rooms failed"
count="$(printf '%s' "$rooms" | jval 'd.length')" || fail "GET /rooms returned no listings after seeding"
echo "    ${count} listing(s) in the feed"

step "register a throwaway account"
email="ci-$(date +%s)-$RANDOM@example.com"
reg="$(curl -sf -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"fullName\":\"CI Bot\",\"email\":\"$email\",\"password\":\"CiPassword123!\",\"acceptTerms\":true}")" \
  || fail "POST /auth/register failed"
token="$(printf '%s' "$reg" | jval 'd.accessToken')" || fail "register response had no accessToken"
printf '%s' "$reg" | check 'd.user.role === "USER"' \
  || fail "a brand-new account did not start as USER"
echo "    ${email}"

step "protected route accepts the token"
me="$(curl -sf "$BASE/auth/me" -H "Authorization: Bearer $token")" || fail "GET /auth/me failed"
printf '%s' "$me" | EXPECT_EMAIL="$email" check 'd.email === process.env.EXPECT_EMAIL' \
  || fail "GET /auth/me returned a different user than registered"

# NOTE: the payload deliberately asks for ACTIVE. The server must ignore it -
# approval is the admin's decision, not the client's.
step "publish a listing (the client asks for ACTIVE on purpose)"
room="$(curl -sf -X POST "$BASE/rooms" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "CI smoke listing",
    "description": "Created by the CI smoke test to exercise the publish flow.",
    "accommodationType": "studio",
    "furnished": "furnished",
    "rent": 1000,
    "currency": "GBP",
    "cityName": "London",
    "area": "Smokeville",
    "status": "ACTIVE"
  }')" || fail "POST /rooms failed"
id="$(printf '%s' "$room" | jval 'd.id')" || fail "POST /rooms returned no id"
printf '%s' "$room" | check "d.status === 'PENDING' && d.city === 'London' && d.demoData === false" \
  || fail "server did not force PENDING (it must ignore a client-requested ACTIVE)"
echo "    created ${id} (status PENDING)"

step "an unapproved listing is invisible to everyone else"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rooms/$id")"
[ "$code" = "404" ] || fail "pending listing is publicly reachable (HTTP ${code})"
curl -sf "$BASE/rooms" | EXPECT_ID="$id" \
  check '!d.map(r => r.id).includes(process.env.EXPECT_ID)' \
  || fail "pending listing leaked into the public feed"
curl -sf "$BASE/rooms/$id" -H "Authorization: Bearer $token" \
  | EXPECT_ID="$id" check 'd.id === process.env.EXPECT_ID' \
  || fail "the owner cannot open their own pending listing"
echo "    hidden from strangers, visible to its owner"

step "promote the throwaway to admin (the token already in hand must now work)"
set_role "$email" "ADMIN" || fail "could not promote the CI account to admin"

step "the admin review queue shows it"
queue="$(curl -sf "$BASE/admin/moderation/queue" -H "Authorization: Bearer $token")" \
  || fail "GET /admin/moderation/queue failed for an admin"
printf '%s' "$queue" | EXPECT_ID="$id" \
  check 'd.pending.map(r => r.id).includes(process.env.EXPECT_ID)' \
  || fail "the pending listing is missing from the review queue"

step "reject with a reason, then resubmit"
rej="$(curl -sf -X PATCH "$BASE/admin/moderation/$id/reject" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"CI smoke: photos do not match."}')" || fail "reject failed"
printf '%s' "$rej" | check "d.status === 'REJECTED' && d.reviewNote === 'CI smoke: photos do not match.'" \
  || fail "rejection did not record status + reason"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rooms/$id")"
[ "$code" = "404" ] || fail "rejected listing is publicly reachable (HTTP ${code})"
curl -sf -X PATCH "$BASE/rooms/$id" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PENDING"}' \
  | check "d.status === 'PENDING' && d.reviewNote === null" \
  || fail "resubmitting did not clear the previous verdict"

step "approve it - only now does it become public"
appr="$(curl -sf -X PATCH "$BASE/admin/moderation/$id/approve" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' -d '{}')" || fail "approve failed"
printf '%s' "$appr" | check "d.status === 'ACTIVE' && d.reviewNote === null && d.reviewedAt" \
  || fail "approve did not activate the listing"
curl -sf "$BASE/rooms/$id" | EXPECT_ID="$id" check 'd.id === process.env.EXPECT_ID' \
  || fail "approved listing is not publicly visible"
curl -sf "$BASE/rooms?city=London" | EXPECT_ID="$id" \
  check 'd.map(r => r.id).includes(process.env.EXPECT_ID)' \
  || fail "city-filtered feed is missing the approved listing"
echo "    live after approval"

step "pause hides it from the public feed"
curl -sf -X PATCH "$BASE/rooms/$id" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PAUSED"}' | check "d.status === 'PAUSED'" \
  || fail "PATCH /rooms/:id (pause) failed"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rooms/$id")"
[ "$code" = "404" ] || fail "paused listing is still public (HTTP ${code})"
# Resuming works because the listing was approved before it was paused.
curl -sf -X PATCH "$BASE/rooms/$id" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"status":"ACTIVE"}' | check "d.status === 'ACTIVE'" \
  || fail "an already-approved listing could not be reactivated"
curl -sf -X PATCH "$BASE/rooms/$id" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PAUSED"}' >/dev/null || fail "could not pause it again"

step "a foreign account cannot touch the listing"
email2="ci2-$(date +%s)-$RANDOM@example.com"
reg2="$(curl -sf -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"fullName\":\"CI Other\",\"email\":\"$email2\",\"password\":\"CiPassword123!\",\"acceptTerms\":true}")" \
  || fail "second register failed"
token2="$(printf '%s' "$reg2" | jval 'd.accessToken')"
foreign_code="$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/rooms/$id" \
  -H "Authorization: Bearer $token2")"
[ "$foreign_code" = "403" ] || fail "expected 403 deleting someone else's listing, got ${foreign_code}"
# ...and a non-admin cannot reach the admin surface at all.
admin_code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/moderation/queue" \
  -H "Authorization: Bearer $token2")"
[ "$admin_code" = "403" ] || fail "expected 403 for a non-admin on /admin/*, got ${admin_code}"
echo "    got 403 as expected (delete + admin surface)"

step "the owner deletes it"
curl -sf -X DELETE "$BASE/rooms/$id" -H "Authorization: Bearer $token" >/dev/null \
  || fail "DELETE /rooms/:id failed"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rooms/$id")"
[ "$code" = "404" ] || fail "deleted listing still answers (HTTP ${code})"

step "member endpoints answer for the caller"
curl -sf "$BASE/notifications" -H "Authorization: Bearer $token" \
  | check 'Array.isArray(d)' || fail "GET /notifications failed"
curl -sf "$BASE/host/stats" -H "Authorization: Bearer $token" \
  | check "Object.hasOwn(d, 'totalListings') && Object.hasOwn(d, 'unreadMessages')" \
  || fail "GET /host/stats failed"
curl -sf "$BASE/messages/conversations" -H "Authorization: Bearer $token" \
  | check 'Array.isArray(d)' || fail "GET /messages/conversations failed"

step "anonymous requests are rejected"
anon_code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/host/stats")"
[ "$anon_code" = "401" ] || fail "expected 401 without a token, got ${anon_code}"
anon_admin="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/moderation/queue")"
[ "$anon_admin" = "401" ] || fail "expected 401 for anonymous /admin/*, got ${anon_admin}"

step "leave no admin behind (so this script is safe on any database)"
set_role "$email" "USER" || fail "could not demote the CI account again"

echo ""
echo "all smoke tests passed"
