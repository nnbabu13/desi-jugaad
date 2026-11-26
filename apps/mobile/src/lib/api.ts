/**
 * ============================================================================
 * API client
 * ============================================================================
 *
 * Thin typed wrapper over the Desi Jugaad REST API (NestJS, `/api/v1`).
 *
 * Responsibilities kept in one place so no screen talks to `fetch` directly:
 *   - base URL resolution (env var, with LAN fallback for physical devices)
 *   - JSON encoding and the shared error envelope
 *   - access-token injection and a single-flight refresh on 401
 *   - normalising failures into `ApiError` so UI can branch on status
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/* ---------------------------------------------------------------------------
 * Base URL
 * ------------------------------------------------------------------------ */

/**
 * Resolution order:
 *   1. `EXPO_PUBLIC_API_URL` (release builds and CI)
 *   2. The Expo dev server's host, so a physical phone reaches the laptop
 *      instead of its own `localhost`
 *   3. `localhost` (iOS simulator / web)
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { debuggerHost?: string }).debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000`;
    }
  }

  if (Platform.OS === 'android') {
    // The Android emulator reaches the host machine via this alias.
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

export const API_BASE_URL = resolveBaseUrl();
const API_PREFIX = `${API_BASE_URL}/api/v1`;

/* ---------------------------------------------------------------------------
 * Errors
 * ------------------------------------------------------------------------ */

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** True for network/timeout failures (no HTTP response at all). */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServer(): boolean {
    return this.status >= 500;
  }
}

interface ErrorEnvelope {
  statusCode?: number;
  message?: string | string[];
  details?: unknown;
}

function toMessage(status: number, body: unknown): string {
  const fallback =
    status === 0
      ? 'Cannot reach the server. Check your connection and try again.'
      : status >= 500
        ? 'Something went wrong on our side. Please try again.'
        : 'Request failed. Please try again.';

  if (!body || typeof body !== 'object') return fallback;

  const env = body as ErrorEnvelope;
  if (Array.isArray(env.message) && env.message.length > 0) {
    return env.message[0];
  }
  if (typeof env.message === 'string' && env.message.trim()) {
    return env.message;
  }
  return fallback;
}

/* ---------------------------------------------------------------------------
 * Token storage
 * ------------------------------------------------------------------------ */

type TokenListener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<TokenListener>();

/** Set by the auth store; kept here so `request` can attach it. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const l of listeners) l(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onAccessTokenChange(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---------------------------------------------------------------------------
 * Request
 * ------------------------------------------------------------------------ */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Attach the current access token. Defaults to true. */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = path.startsWith('http') ? path : `${API_PREFIX}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * The access token lives in memory only, so a page reload starts with none
 * even though the httpOnly refresh cookie is still valid. This exchanges that
 * cookie exactly once per page load, before the first authenticated request,
 * so restore never races a bare 401. Failures are cached: an anonymous page
 * must not re-attempt the refresh on every request.
 */
let sessionRestore: Promise<boolean> | null = null;

function ensureSessionRestored(): Promise<boolean> {
  if (!sessionRestore) sessionRestore = refreshAccessToken();
  return sessionRestore;
}

/**
 * Drops the cached boot-time restore and retries it. Used by the Home "Retry"
 * banner: without this, a failed restore would stay cached for the whole page
 * load and the retry could never succeed even after the server recovers.
 */
export function resetSessionRestore(): Promise<boolean> {
  sessionRestore = null;
  return ensureSessionRestored();
}

/**
 * Refreshes the access token using the httpOnly refresh cookie. Single-flight:
 * concurrent 401s share one refresh instead of racing and revoking each other.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        credentials: 'include',
      });
      if (!res.ok) {
        setAccessToken(null);
        return false;
      }
      const data = (await res.json()) as { accessToken?: string };
      if (!data.accessToken) {
        setAccessToken(null);
        return false;
      }
      setAccessToken(data.accessToken);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, headers = {}, signal } = options;

  // Wait for the boot-time cookie exchange before the first authed call so
  // screens mounted right after a reload do not flash a 401.
  if (auth && !accessToken) {
    await ensureSessionRestored();
  }

  const doFetch = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';

    const token = getAccessToken();
    if (auth && token) finalHeaders.Authorization = `Bearer ${token}`;

    return fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, toMessage(0, null));
  }

  // One automatic retry after a transparent token refresh.
  if (res.status === 401 && auth && getAccessToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      try {
        res = await doFetch();
      } catch {
        throw new ApiError(0, toMessage(0, null));
      }
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, toMessage(res.status, parsed), parsed);
  }

  return parsed as T;
}

/* ---------------------------------------------------------------------------
 * Public helpers
 * ------------------------------------------------------------------------ */

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/** Renders an unknown thrown value as a user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}

/** True when the failure was caused by being offline / unreachable. */
export function isOffline(err: unknown): boolean {
  return err instanceof ApiError && err.isNetwork;
}
