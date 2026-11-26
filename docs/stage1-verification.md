# Stage 1 — Verification Log

API: `http://localhost:4000/api/v1` (NestJS 12 + Prisma 7.10.1 + PostgreSQL 16.15 over SSH tunnel)
Date: 2026-11-15
Typecheck: `npx tsc --noEmit -p apps/api/tsconfig.json` → **0 errors**

## Infrastructure

| Check | Result |
|---|---|
| SSH tunnel `localhost:1521 → 127.0.0.1:5432` | UP (pid 11896) |
| Role `desi_jugaad_user` (CREATEDB for shadow DB) | created, TCP auth verified |
| Databases `desi_jugaad` / `desi_jugaad_test` | created, owner `desi_jugaad_user` |
| Existing `tixpass_db` / `tixpass_test` | **untouched** |
| Migration `20261115071226_init_core` | applied |
| Prisma client → `apps/api/src/generated/prisma` | generated (7.10.1, `prisma-client` generator, CJS) |
| Seed | 27 countries, 107 cities, 3 demo accounts (`demoData=true`, none verified) |

## Endpoint tests (all executed against the live server)

### Public geography

| # | Request | Expected | Actual |
|---|---|---|---|
| 1 | `GET /health` | `status: ok`, `database.status: up` | ✅ `ok` / `up`, latency 1443 ms |
| 2 | `GET /countries?featured=true` | 6 featured countries with city counts | ✅ `count=6` (AU, CA, IN, AE, GB, US) |
| 3 | `GET /countries/GB/cities?launch=true` | 3 launch cities | ✅ `count=3` — London, Birmingham, Manchester |
| 4 | `GET /locations/search?q=tor` | Toronto under Canada | ✅ `total=1` → `Toronto, Canada` |

### Auth (register → me → login → refresh → verify → logout)

| # | Scenario | Expected | Actual |
|---|---|---|---|
| 5 | `POST /auth/register` | 201, `status=PENDING_VERIFICATION`, `emailVerified=false` | ✅ token len 285 |
| 6 | `GET /auth/me` with access token | correct user, `verified:false` | ✅ `{"type":"EMAIL","verified":false}` |
| 7 | `POST /auth/login` wrong password | 401 (same message as unknown user — no enumeration) | ✅ HTTP 401 |
| 8 | `POST /auth/login` correct password | 200 + access token + httpOnly refresh cookie | ✅ |
| 9 | `POST /auth/refresh` via cookie only | new access token, **rotated** | ✅ `rotated=True` |
| 10 | `GET /users/me` with refreshed token | profile resolved | ✅ `Test User`, `public`, `demoData=False` |
| 11 | `POST /auth/verify-email` | `status=ACTIVE`, `emailVerified=true` | ✅ |
| 12 | replay same verification token | rejected (single-use) | ✅ HTTP 400 |
| 13 | `POST /auth/register` duplicate email | 409 | ✅ HTTP 409 |
| 14 | `POST /auth/logout` | refresh revoked, cookie cleared | ✅ |

### Validation & authorisation

| # | Scenario | Expected | Actual |
|---|---|---|---|
| 15 | `PATCH /users/me` valid location | saved | ✅ `London, United Kingdom`, `living_abroad` |
| 16 | city/country mismatch (Vancouver + GB) | 400 | ✅ HTTP 400 |
| 17 | register with weak password + `acceptTerms=false` | 400 with field details | ✅ HTTP 400 |
| 18 | `GET /users/me` with **no** token | 401 | ✅ HTTP 401 |
| 19 | `GET /users/<unknown-uuid>` | 404 | ✅ HTTP 404 |
| 20 | `GET /users/not-a-uuid` | 400 (ParseUUIDPipe) | ✅ HTTP 400 |

### Profile visibility

| # | Viewer | Target visibility | Result |
|---|---|---|---|
| 21 | anonymous | `public` | ✅ full card, `restricted` absent |
| 22 | anonymous | `private` | ✅ `restricted=true`, `bio=null` |
| 23 | owner | `private` | ✅ `isSelf=true`, full access |
| 24 | other signed-in user | `private` | ✅ `restricted=true`, `isSelf=false` |

## Policy rules confirmed in code + at runtime

- **Verified badge derives from a completed `UserVerification` row.** `emailVerified` flips to `true` only after `POST /auth/verify-email` sets `status=VERIFIED`; no other path sets it.
- **Seeded content can never show a verified badge.** All 3 demo accounts are created with `status=PENDING_VERIFICATION`, no `UserVerification` rows, and `demoData=true`.
- **No exact residential address is stored or exposed.** Profiles carry only country + city.
- **No ads, payment or compensation fields exist anywhere in the Stage 1 schema.**

## Not yet done in Stage 1

- Transactional email provider (verification link is logged — dev only, must be replaced before release).
- Expo mobile shell + 5-tab navigation.
- Next.js web shell.
- `docs/policy-risk-register.md` (IAP, ATT, EU/UK ad consent, parcel liability).
