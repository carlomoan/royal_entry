// ==============================================================================
// FILE: src/api/scanner.ts
// ==============================================================================
import { apiClient } from "./client";
import type { ScanCheckInResult, ScanStats } from "@/types";

export const scannerApi = {
  stats: async (eventId: string): Promise<ScanStats> => {
    const res = await apiClient.get(`/events/${eventId}/scan-stats`);
    return res.data.data;
  },

  checkIn: async (
    eventId: string,
    shortLink: string,
    scanSource = "qr",
    notes?: string,
  ): Promise<ScanCheckInResult> => {
    const res = await apiClient.post(`/events/${eventId}/scan`, {
      short_link: shortLink,
      scan_source: scanSource,
      notes,
    });
    return res.data.data;
  },
};
