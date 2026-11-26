/**
 * Auth API calls.
 */

import { api, setAccessToken } from './api';
import type {
  AuthResponse,
  LoginInput,
  MeResponse,
  PublicProfileResponse,
  RegisterInput,
  UpdateProfileInput,
} from './api-types';

export const authApi = {
  register: (input: RegisterInput) => api.post<AuthResponse>('/auth/register', input, { auth: false }),

  login: (input: LoginInput) => api.post<AuthResponse>('/auth/login', input, { auth: false }),

  /** Uses the httpOnly refresh cookie; the body token is a fallback. */
  refresh: () => api.post<AuthResponse>('/auth/refresh', {}, { auth: false }),

  logout: () => api.post<{ ok: true }>('/auth/logout', {}),

  me: () => api.get<MeResponse>('/auth/me'),

  verifyEmail: (token: string) =>
    api.post<{ user: MeResponse }>('/auth/verify-email', { token }, { auth: false }),

  updateProfile: (input: UpdateProfileInput) => api.patch<MeResponse>('/users/me', input),

  publicProfile: (id: string) => api.get<PublicProfileResponse>(`/users/${id}`),
};

/** Persists the access token in memory for the session. */
export function adoptSession(accessToken: string): void {
  setAccessToken(accessToken);
}

export function clearSession(): void {
  setAccessToken(null);
}

export default authApi;
