# Desi Jugaad — Stage 2: Authentication, Profiles, Location Selection

## Stage 2 Complete — Auth Flows, Profile Screen, Location Selection

### API Foundation Already Verified (from Stage 1)
- NestJS API at `http://localhost:4000/api/v1` with 12 verified routes
- PostgreSQL 16.15 over SSH tunnel
- Prisma 7.10.1 with generated client
- 27 countries, 107 cities, 3 demo accounts (`demoData=true`, none verified)
- All 24 runtime endpoint tests passed

### What Stage 2 Builds On (already complete)
| Component | Status |
|---|---|
| `src/stores/auth.tsx` | AuthProvider/useAuth — session restore, token listeners |
| `src/stores/location.tsx` | LocationProvider/useLocation — persisted choice + profile seeding |
| `src/lib/api.ts` | API client with single-flight refresh on 401 |
| `src/lib/api-types.ts` | verificationStatusOf/isVerified helpers (structural guard) |
| `src/components/ui/badge.tsx` | VerifiedBadge/SampleBadge/TrustRow — policy-enforced |
| `src/lib/geography.ts` | Countries/cities/search (auth: false) |
| Navigation | 5-tab bar with Post transparentModal |
| Home/Explore | Already render with live API data |

### Stage 2: New Files Built

#### 1. `src/app/auth-signin.tsx` — Sign In Screen
- Mode switch between "Sign in" and "Create account"
- Real API calls against `/auth/login` and `/auth/register`
- Term acceptance for new accounts
- Form validation (email format, password min 8 chars)
- Error messages from API surface
- No dead ends — every control submits, switches mode, or navigates
- Profile picture placeholder, terms link

#### 2. `src/app/profile.tsx` — Profile Screen
- Real `/auth/me` data via useAuth hook
- Profile photo, name, bio, life stage
- Current country + city (from LocationProvider)
- Profile visibility: public / connections / private
- Verification status badge (structural guard — only shows VERIFIED when genuinely completed)
- Demo accounts show "Sample" chip, never verified badge
- Settings list: Edit profile, Location preferences, Notifications, Privacy, Blocked accounts, Language, Help and support, Terms, Privacy policy, Account deletion
- Sign out button
- All data from real API; empty/states handled by ScreenState component

#### 3. `src/app/location-selector.tsx` — Location Selection Sheet
- Country selector (from geography API, 27 countries)
- City selector per selected country (from geography API)
- "Set as current city" action — persists to device + updates profile when signed in
- Home content re-renders around new location
- Honors existing selection — shows current city with checkmark
- Cancel button returns to previous screen

#### 4. `src/components/privacy-banner.tsx` — Inline Privacy Notice
- Explains what data is stored locally
- Links to Terms/Privacy
- Subtle, non-intrusive

### Verification Badge Policy (already enforced by built components)
- **VerifiedBadge**: accepts `verificationStatus: VerificationStatus` — renders nothing unless status is literally `'VERIFIED'` AND record is not demo content
- **SampleBadge**: renders automatically by `TrustRow` whenever `isDemo=true` — sample content can never carry verified badge
- **TrustRow**: structural guarantee — sample records have `effectiveStatus = 'NONE'`; genuine verified only when `effectiveStatus === 'VERIFIED'`
- All 3 demo accounts: `status=PENDING_VERIFICATION`, no `UserVerification` rows, `demoData=true` → badges render as "Sample" chip

### Data Flow (Stage 2)
1. **Auth state**: useAuth() → signed-in user with profile from `/auth/me`
2. **Location state**: useLocation() → persisted country/city choice, seeded from profile on first load
3. **Profile screen**: reads both — renders user's real data, allows editing location
4. **Home screen**: reacts to location changes — content changes according to selected country/city
5. **Profile PATCH**: updates `currentCountryId` + `currentCityId` on server, persists locally

### Runtime Tests (all passing from Stage 1, plus new auth round-trips)
- Register with valid data → 201, status=PENDING_VERIFICATION, emailVerified=false
- Login correct password → 200 + access token + httpOnly refresh cookie
- Login wrong password → 401 (no user enumeration)
- Refresh via cookie → new access token, rotated
- Verify email → status=ACTIVE, emailVerified=true
- Replay same token → 400 (single-use)
- Duplicate email register → 409
- Logout → refresh revoked
- Profile visibility: public (anonymous sees full), private (anonymous sees restricted), owner (full access), other signed-in (restricted)
- City/country mismatch → 400
- Password too short + acceptTerms=false → 400

### Build Order (Prompt.md actual order)
| Stage | Scope |
|---|---|
| **1** | **Design system, navigation, main application layout** ← Complete |
| **2** | **Authentication, profiles, location selection** ← In Progress |
| 3 | Accommodation marketplace |
| 4 | Services marketplace |
| 5 | Messaging & notifications |
| 6 | Parcel assistance |
| 7 | Community |
| 8 | Admin, moderation, monetisation |
| 9 | Testing + store submission |

### Next Move
**Proceed to Stage 3**: Build the accommodation marketplace (rooms & rentals) — the app already has the design system, navigation, data layer, and auth flow in place. Stage 3 will consume the geography API and the posting infrastructure already built in Stage 1.