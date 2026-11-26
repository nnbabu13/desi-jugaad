/**
 * Geography API calls. These are the only endpoints Stage 1 screens consume,
 * so they live in one place rather than being inlined into components.
 */

import { api } from './api';
import type {
  CountryListResponse,
  CountryWithCities,
  LocationSearchResponse,
} from './api-types';

export const geographyApi = {
  /** Countries, optionally filtered by search text or featured flag. */
  countries: (params: { q?: string; featured?: boolean; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<CountryListResponse>('/countries', {
      query: { q: params.q, featured: params.featured, limit: params.limit },
      auth: false,
      signal,
    }),

  /** Cities for a country. `countryRef` accepts a UUID or an ISO-3166 code. */
  cities: (
    countryRef: string,
    params: { q?: string; launch?: boolean; limit?: number } = {},
    signal?: AbortSignal,
  ) =>
    api.get<CountryWithCities>(`/countries/${encodeURIComponent(countryRef)}/cities`, {
      query: { q: params.q, launch: params.launch, limit: params.limit },
      auth: false,
      signal,
    }),

  /** Unified search across countries and cities, used by the search bars. */
  searchLocations: (q: string, limit = 20, signal?: AbortSignal) =>
    api.get<LocationSearchResponse>('/locations/search', {
      query: { q, limit },
      auth: false,
      signal,
    }),
};

export default geographyApi;
