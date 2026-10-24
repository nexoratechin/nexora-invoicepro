import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from './api';

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/**
 * A small fetch hook: one request per path, an abort on unmount, and a manual
 * reload for after a mutation. Deliberately not a cache, because every screen
 * here shows one resource at a time.
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (path === null) {
      setLoading(false);

      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    apiRequest<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;

        if (cause instanceof ApiError) {
          setError(cause);
        } else {
          setError(new ApiError('The API could not be reached', 0, 'NETWORK_ERROR'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [path, version]);

  return { data, error, loading, reload };
}

/** Waits for a pause in typing before a search request goes out. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
