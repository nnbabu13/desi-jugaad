#!/usr/bin/env bash
# ============================================================================
# CI smoke test - runs against a booted local API (see .github/workflows/ci.yml).
#
# Proves the real thing works end to end on a freshly seeded database:
#   1. the public rooms feed serves seeded listings
#   2. register -> access token -> protected /auth/me
#   3. publish a listing (POST /rooms) and see it go live
#   4. pause it (it must leave the public feed) and delete it
#   5. member endpoints answer; anonymous callers get 401
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
echo "    ${email}"

step "protected route accepts the token"
me="$(curl -sf "$BASE/auth/me" -H "Authorization: Bearer $token")" || fail "GET /auth/me failed"
printf '%s' "$me" | EXPECT_EMAIL="$email" check 'd.email === process.env.EXPECT_EMAIL' \
  || fail "GET /auth/me returned a different user than registered"

step "publish a listing"
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
printf '%s' "$room" | check "d.status === 'ACTIVE' && d.city === 'London' && d.demoData === false" \
  || fail "published listing is not ACTIVE/London (or was wrongly marked demoData)"
echo "    created ${id}"

step "the listing is publicly visible"
curl -sf "$BASE/rooms/$id" | EXPECT_ID="$id" check 'd.id === process.env.EXPECT_ID' \
  || fail "GET /rooms/:id did not return the new listing"
curl -sf "$BASE/rooms?city=London" | EXPECT_ID="$id" \
  check 'd.map(r => r.id).includes(process.env.EXPECT_ID)' \
  || fail "city-filtered feed is missing the new listing"

step "pause hides it from the public feed, delete removes it"
curl -sf -X PATCH "$BASE/rooms/$id" \
  -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"status":"PAUSED"}' | check "d.status === 'PAUSED'" \
  || fail "PATCH /rooms/:id (pause) failed"
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/rooms/$id")"
[ "$code" = "404" ] || fail "paused listing is still public (HTTP ${code})"

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
echo "    got 403 as expected"

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

echo ""
echo "all smoke tests passed"
