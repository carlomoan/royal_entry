"use client";
// ==============================================================================
// Offline-first read hook: returns the cached copy immediately (so pages render
// instantly, even offline), then refreshes from the API when reachable. The
// axios client keeps the cache fresh on every successful GET.
// ==============================================================================
import { useEffect, useState } from "react";
import api from "./api";
import { getCached } from "./cache";

export function useCachedQuery<T = any>(url: string, enabled = true) {
  const [data, setData] = useState<T | undefined>(() => getCached(url) as T | undefined);
  const [isLoading, setIsLoading] = useState(() => getCached(url) === undefined);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .get(url)
      .then((res) => {
        if (cancelled) return;
        setData((res.data?.data ?? res.data) as T);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);

  return { data, isLoading };
}