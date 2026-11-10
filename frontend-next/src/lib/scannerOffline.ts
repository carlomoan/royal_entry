"use client";
// ==============================================================================
// Offline scanner store. The event's guests + invitations are cached locally
// (24h) so the scanner can look up a guest by their QR short-link and check
// them in even with no connection. Offline check-ins are recorded locally and
// the underlying mutation is queued (see lib/offline.ts) to sync when online.
// ==============================================================================

const PREFIX = "scanner_offline";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface EventData {
  guests: any[];
  invitations: any[];
  savedAt: number;
}

interface OfflineArrival {
  short_link: string;
  guest_name: string;
  at: number;
}

export function saveEventData(eventId: string, guests: any[], invitations: any[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${PREFIX}_data_${eventId}`,
      JSON.stringify({ guests, invitations, savedAt: Date.now() })
    );
  } catch {
    /* ignore quota errors */
  }
}

export function getEventData(eventId: string): EventData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}_data_${eventId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as EventData;
    if (Date.now() - data.savedAt > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

/** Resolve a guest from a scanned short-link / payload using the local cache. */
export function findGuestByLink(eventId: string, shortLink: string): any | null {
  const data = getEventData(eventId);
  if (!data) return null;
  const link = shortLink.trim();
  const inv = data.invitations.find(
    (i) => i.short_link === link || i.scan_payload === link
  );
  if (!inv) return null;
  return data.guests.find((g) => g.id === inv.guest_id) ?? null;
}

export function getOfflineArrivals(eventId: string): OfflineArrival[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(`${PREFIX}_arrivals_${eventId}`) ?? "[]");
  } catch {
    return [];
  }
}

export function markOfflineArrival(eventId: string, shortLink: string, guestName: string): void {
  if (typeof window === "undefined") return;
  const arr = getOfflineArrivals(eventId);
  if (!arr.some((a) => a.short_link === shortLink)) {
    arr.push({ short_link: shortLink, guest_name: guestName, at: Date.now() });
    window.localStorage.setItem(`${PREFIX}_arrivals_${eventId}`, JSON.stringify(arr));
  }
}

export function isAlreadyArrivedOffline(eventId: string, shortLink: string): boolean {
  return getOfflineArrivals(eventId).some((a) => a.short_link === shortLink);
}