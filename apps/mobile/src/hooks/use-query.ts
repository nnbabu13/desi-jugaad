/**
 * useQuery - a minimal async data hook.
 *
 * Deliberately dependency-free: the app only needs load / reload / error for
 * a handful of endpoints, and a 200KB library would be dead weight. If the
 * app later needs caching, deduping or background refetch, swap the internals
 * of this hook - call sites will not change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** True only for the initial load; use for skeletons. */
  initialLoading: boolean;
  refetch: () => void;
  /** Optimistic/local update without a network round trip. */
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

export function useQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean } = {},
): QueryResult<T> {
  const enabled = options.enabled ?? true;

  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const run = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setDataState(result);
        setHasLoaded(true);
      })
      .catch((err) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        if ((err as Error)?.name === 'AbortError') return;
        setError(err);
      })
      .finally(() => {
        if (controller.signal.aborted || !mountedRef.current) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Defer the kick-off so no state is set synchronously inside the effect.
    Promise.resolve().then(() => {
      if (enabled && mountedRef.current) run();
    });

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) =>
      typeof updater === 'function' ? (updater as (p: T | undefined) => T)(prev) : updater,
    );
    setHasLoaded(true);
  }, []);

  return {
    data,
    error,
    loading,
    initialLoading: loading && !hasLoaded,
    refetch: run,
    setData,
  };
}

export default useQuery;
