/**
 * ============================================================================
 * Location store - the user's selected country + city
 * ============================================================================
 *
 * Prompt.md §4: "Home content should change according to the user's selected
 * country and city."
 *
 * This is the single source of truth for that selection. It is persisted so
 * the choice survives a relaunch, and it is seeded from the signed-in user's
 * profile location on first load so onboarding and Home agree.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/stores/auth';

const STORAGE_KEY = 'desi-jugaad:location:v1';

export interface SelectedLocation {
  countryId: string;
  countryName: string;
  countryIso: string;
  countryFlag: string | null;
  cityId: string;
  cityName: string;
}

export interface LocationContextValue {
  /** Null until the user has chosen a city (or their profile provided one). */
  location: SelectedLocation | null;
  /** True while the persisted value is being read. */
  loading: boolean;
  setLocation: (location: SelectedLocation) => Promise<void>;
  clearLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function parseStored(raw: string | null): SelectedLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SelectedLocation;
    if (
      parsed &&
      typeof parsed.countryId === 'string' &&
      typeof parsed.cityId === 'string' &&
      typeof parsed.cityName === 'string'
    ) {
      return parsed;
    }
  } catch {
    // Corrupt value - fall through and treat as unset.
  }
  return null;
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();

  const [location, setLocationState] = useState<SelectedLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  // 1. Restore the persisted choice.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled) setLocationState(parseStored(raw));
      } catch {
        // Storage unavailable - continue with no persisted choice.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. If nothing is stored, adopt the profile location once the user loads.
  useEffect(() => {
    if (loading || seededRef.current) return;
    if (location) return;
    if (status !== 'authenticated') return;

    const profile = user?.profile;
    if (profile?.currentCountry && profile?.currentCity) {
      seededRef.current = true;
      const derived: SelectedLocation = {
        countryId: profile.currentCountry.id,
        countryName: profile.currentCountry.name,
        countryIso: profile.currentCountry.isoCode ?? '',
        countryFlag: profile.currentCountry.flagEmoji ?? null,
        cityId: profile.currentCity.id,
        cityName: profile.currentCity.name,
      };
      // Deferred so the effect body itself never sets state synchronously.
      Promise.resolve().then(() => {
        setLocationState(derived);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(derived)).catch(() => {});
      });
    }
  }, [loading, location, status, user]);

  const setLocation = useCallback(async (next: SelectedLocation) => {
    setLocationState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Persisting is best-effort; the in-memory value still applies.
    }
  }, []);

  const clearLocation = useCallback(async () => {
    setLocationState(null);
    seededRef.current = false;
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore - nothing to recover from.
    }
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({ location, loading, setLocation, clearLocation }),
    [location, loading, setLocation, clearLocation],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}

export default LocationContext;
