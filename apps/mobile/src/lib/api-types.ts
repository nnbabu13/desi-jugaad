/**
 * Response types mirroring the API contract. Kept in one file so screens and
 * hooks share a single definition instead of re-declaring shapes inline.
 */

/* ---------------------------------------------------------------------------
 * Shared
 * ------------------------------------------------------------------------ */

export interface Country {
  id: string;
  isoCode: string;
  name: string;
  currencyCode: string | null;
  phoneCode: string | null;
  flagEmoji: string | null;
  isFeatured: boolean;
  cityCount: number;
}

export interface CountrySummary {
  id: string;
  isoCode: string;
  name: string;
  flagEmoji: string | null;
  currencyCode: string | null;
}

export interface City {
  id: string;
  name: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  isLaunch: boolean;
  isFeatured: boolean;
}

export interface CityWithCountry {
  id: string;
  name: string;
  region: string | null;
  isLaunch: boolean;
  country: {
    id: string;
    isoCode: string;
    name: string;
    flagEmoji: string | null;
  };
}

export interface CountryWithCities {
  country: {
    id: string;
    isoCode: string;
    name: string;
    currencyCode: string | null;
    phoneCode: string | null;
    flagEmoji: string | null;
  };
  items: City[];
  total: number;
}

export interface CountryListResponse {
  items: Country[];
  total: number;
}

export interface LocationSearchResponse {
  countries: {
    type: 'country';
    id: string;
    isoCode: string;
    name: string;
    flagEmoji: string | null;
    currencyCode: string | null;
  }[];
  cities: CityWithCountry[];
  total: number;
}

/* ---------------------------------------------------------------------------
 * Auth
 * ------------------------------------------------------------------------ */

export interface PublicUser {
  id: string;
  email: string;
  phone: string | null;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  emailVerified: boolean;
  phoneVerified: boolean;
  authProvider: 'EMAIL' | 'PHONE' | 'GOOGLE' | 'APPLE';
  createdAt: string;
}

export interface VerificationFlag {
  type: 'EMAIL' | 'PHONE' | 'IDENTITY';
  verified: boolean;
}

export interface ProfileLocation {
  id: string;
  isoCode?: string;
  name: string;
  flagEmoji?: string | null;
  currencyCode?: string | null;
  phoneCode?: string | null;
  region?: string | null;
}

export interface UserProfile {
  fullName: string;
  bio: string | null;
  avatarUrl: string | null;
  lifeStage: string | null;
  languages: string[];
  profileVisibility: 'public' | 'connections' | 'private';
  demoData: boolean;
  currentCountry: ProfileLocation | null;
  currentCity: ProfileLocation | null;
  intendedCountry: ProfileLocation | null;
  intendedCity: ProfileLocation | null;
}

export interface MeResponse extends PublicUser {
  profile: UserProfile | null;
  verifications: VerificationFlag[];
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  acceptTerms: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  bio?: string;
  /** `null` clears the value; the API's IsOptional accepts it. */
  lifeStage?: string | null;
  languages?: string[];
  currentCountryId?: string | null;
  currentCityId?: string | null;
  intendedCountryId?: string | null;
  intendedCityId?: string | null;
  profileVisibility?: 'public' | 'connections' | 'private';
  avatarUrl?: string | null;
}

export interface PublicProfileResponse {
  id: string;
  fullName: string;
  demoData: boolean;
  verifications: VerificationFlag[];
  bio: string | null;
  avatarUrl: string | null;
  lifeStage: string | null;
  languages: string[];
  currentCountry: ProfileLocation | null;
  currentCity: ProfileLocation | null;
  joinedAt?: string;
  restricted?: boolean;
  isSelf: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  database: { status: 'up' | 'down'; latencyMs?: number };
}

/* ---------------------------------------------------------------------------
 * Verification helpers - used by every trust signal in the UI
 * ------------------------------------------------------------------------ */

/**
 * Maps the API's verification flags to the status the badge component
 * requires. Returns 'NONE' when there is no completed verification, so a
 * missing record can never be mistaken for a verified one.
 */
export function verificationStatusOf(
  flags: VerificationFlag[] | undefined,
  type: VerificationFlag['type'] = 'EMAIL',
): 'VERIFIED' | 'NONE' {
  const flag = flags?.find((f) => f.type === type);
  return flag?.verified ? 'VERIFIED' : 'NONE';
}

/** The single rule for whether a record may show a verified badge. */
export function isVerified(
  flags: VerificationFlag[] | undefined,
  isDemo: boolean,
  type: VerificationFlag['type'] = 'EMAIL',
): boolean {
  if (isDemo) return false;
  return verificationStatusOf(flags, type) === 'VERIFIED';
}
