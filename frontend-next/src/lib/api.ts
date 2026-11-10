// ==============================================================================
// FILE: src/lib/api.ts
// ==============================================================================
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { enqueue, flushQueue, isOnline, type QueuedRequest } from "./offline";
import { cacheGet, getCached } from "./cache";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

/* Attach the access token to every request */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

// High-frequency / sensitive GETs that should not be cached.
const NO_CACHE_PREFIXES = [
  "/auth/me",
  "/notifications",
  "/scan-stats",
  "/unread-count",
];

function shouldCacheGet(url: string): boolean {
  return !NO_CACHE_PREFIXES.some((p) => url.includes(p));
}

/* Offline-first: when a mutation fails because there is no connection, queue it
   locally and return a synthetic success so the UI keeps working. It is
   replayed by flushQueue() when the connection returns. */
api.interceptors.response.use(
  (res) => {
    // Cache successful GET responses for offline reads.
    const method = (res.config?.method ?? "").toLowerCase();
    const url = res.config?.url ?? "";
    if (method === "get" && shouldCacheGet(url)) {
      cacheGet(url, res.data);
    }
    return res;
  },
  async (error) => {
    const original = error.config;
    const method = (original?.method ?? "").toLowerCase();
    const url = original?.url ?? "";

    // Offline GET: fall back to the cached copy so pages still render.
    if (original && !error.response && !isOnline() && method === "get") {
      const cached = getCached(url);
      if (cached !== undefined) {
        return Promise.resolve({ data: cached });
      }
    }

    if (
      original &&
      !error.response &&
      !isOnline() &&
      MUTATION_METHODS.has(method)
    ) {
      enqueue({
        method: (method ?? "post").toUpperCase(),
        url,
        data: original.data,
      });
      return Promise.resolve({ data: { success: true, queued_offline: true } });
    }

    /* Auto-refresh on 401, then retry once. On failure, clean session + redirect. */
    if (original && error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");
        const res = await axios.post("/api/v1/auth/refresh", { refresh_token: refreshToken });
        localStorage.setItem("access_token", res.data.access_token);
        localStorage.setItem("refresh_token", res.data.refresh_token);
        original.headers.Authorization = `Bearer ${res.data.access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("impersonation_original_token");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

/** Replay queued offline mutations through the API client. */
export async function syncOfflineQueue(): Promise<number> {
  const send = async (req: QueuedRequest) => {
    await api.request({ method: req.method, url: req.url, data: req.data });
  };
  return flushQueue(send);
}

// When the connection returns, flush anything queued while offline.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncOfflineQueue().then((n) => {
      if (n > 0) console.info(`[offline] synced ${n} queued change(s)`);
    });
  });
}

export default api;
