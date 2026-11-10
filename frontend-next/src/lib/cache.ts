"use client";
// ==============================================================================
// Read-cache layer for GET responses. Stored in localStorage so data survives
// reloads and is available offline (browser + Tauri). The axios client caches
// successful GETs and falls back to the cache when a GET fails while offline.
//
// SQLite upgrade path (Tauri): mirror these entries into a local SQLite table
// with the same { url, data, cachedAt } shape and keep the same helpers.
// ==============================================================================

const CACHE_KEY = "royalentry_get_cache";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 100;

interface CacheEntry {
  url: string;
  data: unknown;
  cachedAt: number;
}

function readCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CacheEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage quota exceeded — drop the cache rather than crash */
  }
}

/** Store a GET response (keyed by URL). */
export function cacheGet(url: string, data: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
  const cache = readCache();
  cache[url] = { url, data, cachedAt: Date.now() };

  // Bound the cache size (drop oldest entries beyond the cap).
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    const oldest = keys
      .sort((a, b) => cache[a].cachedAt - cache[b].cachedAt)
      .slice(0, keys.length - MAX_ENTRIES);
    oldest.forEach((k) => delete cache[k]);
  }
  writeCache(cache);
}

/** Return a cached GET response if present and not expired. */
export function getCached(url: string, ttlMs: number = DEFAULT_TTL_MS): unknown | undefined {
  const entry = readCache()[url];
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > ttlMs) return undefined;
  return entry.data;
}

/** Remove cached entries whose URL starts with a prefix (e.g. after a mutation). */
export function invalidateCache(prefix: string): void {
  const cache = readCache();
  let changed = false;
  for (const key of Object.keys(cache)) {
    if (key.startsWith(prefix)) {
      delete cache[key];
      changed = true;
    }
  }
  if (changed) writeCache(cache);
}

export function clearCache(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(CACHE_KEY);
}

/** Number of cached entries (for the offline banner / debugging). */
export function cacheSize(): number {
  return Object.keys(readCache()).length;
}