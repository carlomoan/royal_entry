"use client";
// ==============================================================================
// Offline-first support (works in the browser and the Tauri desktop app, where
// localStorage is available). Mutations made while offline are queued locally
// and replayed when the connection returns. Read data can be cached per-page.
//
// SQLite upgrade path (Tauri): swap the localStorage queue for the Tauri SQL
// plugin (`@tauri-apps/plugin-sql`) using the same QueuedRequest shape, and
// keep the same flush logic — the rest of the app is unchanged.
// ==============================================================================
import { useEffect, useState } from "react";

const QUEUE_KEY = "royalentry_offline_queue";

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  data?: unknown;
  queuedAt: number;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function getQueue(): QueuedRequest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function enqueue(req: Omit<QueuedRequest, "id" | "queuedAt">): void {
  if (typeof window === "undefined") return;
  const q = getQueue();
  q.push({
    ...req,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
  });
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearQueue(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(QUEUE_KEY);
}

/** Replay queued mutations. Returns the number flushed. */
export async function flushQueue(send: (req: QueuedRequest) => Promise<void>): Promise<number> {
  const q = getQueue();
  if (q.length === 0 || !isOnline()) return 0;

  let flushed = 0;
  const remaining: QueuedRequest[] = [];
  for (const item of q) {
    try {
      await send(item);
      flushed++;
    } catch {
      remaining.push(item); // keep for the next sync attempt
    }
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  }
  return flushed;
}

/** React hook: true while the app is online. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(isOnline());
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}