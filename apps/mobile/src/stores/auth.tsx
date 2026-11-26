/**
 * ============================================================================
 * Auth store
 * ============================================================================
 *
 * Holds the signed-in user, exposes the auth actions, and restores the
 * session on launch by calling `/auth/me` with the stored access token (the
 * refresh cookie handles renewal automatically inside the API client).
 *
 * Stage 1 ships this because the Profile tab must render real data rather
 * than a mock; Stage 2 builds the sign-in / registration screens on top.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ApiError, onAccessTokenChange, resetSessionRestore } from '@/lib/api';
import { adoptSession, authApi, clearSession } from '@/lib/auth';
import type {
  LoginInput,
  MeResponse,
  RegisterInput,
  UpdateProfileInput,
} from '@/lib/api-types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: MeResponse | null;
  /** Set when the initial session restore failed for a non-auth reason. */
  restoreError: string | null;

  login: (input: LoginInput) => Promise<MeResponse>;
  register: (input: RegisterInput) => Promise<MeResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<MeResponse>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<MeResponse | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMe = useCallback(async (): Promise<MeResponse | null> => {
    try {
      const me = await authApi.me();
      if (mountedRef.current) {
        setUser(me);
        setStatus('authenticated');
        setRestoreError(null);
      }
      return me;
    } catch (err) {
      if (!mountedRef.current) return null;

      if (err instanceof ApiError && err.isUnauthorized) {
        // No valid session - this is a normal anonymous state, not an error.
        clearSession();
        setUser(null);
        setStatus('anonymous');
        setRestoreError(null);
      } else if (err instanceof ApiError && err.isNetwork) {
        setStatus('anonymous');
        setRestoreError('Cannot reach the server. Check your connection.');
      } else {
        setStatus('anonymous');
      }
      return null;
    }
  }, []);

  // Restore the session on mount (deferred so the effect body itself never
  // sets state synchronously).
  useEffect(() => {
    Promise.resolve().then(() => {
      void loadMe();
    });
  }, [loadMe]);

  // If the API client drops the token (e.g. refresh failed), follow suit so
  // the UI never claims to be signed in without a valid token.
  useEffect(
    () =>
      onAccessTokenChange((token) => {
        if (!token && mountedRef.current) {
          setUser(null);
          setStatus('anonymous');
        }
      }),
    [],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await authApi.login(input);
      adoptSession(res.accessToken);
      const me = await loadMe();
      if (!me) throw new ApiError(500, 'Signed in, but could not load your profile.');
      return me;
    },
    [loadMe],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await authApi.register(input);
      adoptSession(res.accessToken);
      const me = await loadMe();
      if (!me) throw new ApiError(500, 'Account created, but could not load your profile.');
      return me;
    },
    [loadMe],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Local sign-out must succeed even if the network call fails.
    }
    clearSession();
    if (mountedRef.current) {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    // A boot-time restore failure is cached for the page's lifetime; drop it
    // so "Retry" really re-attempts the cookie exchange before /auth/me.
    resetSessionRestore();
    await loadMe();
  }, [loadMe]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      const me = await authApi.updateProfile(input);
      if (mountedRef.current) setUser(me);
      return me;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      restoreError,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
    }),
    [status, user, restoreError, login, register, logout, refreshUser, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Convenience for screens that need a signed-in user's id. */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

export default AuthContext;
