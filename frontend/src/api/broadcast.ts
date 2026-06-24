// ==============================================================================
// FILE: src/api/broadcast.ts
// ==============================================================================
import { apiClient } from "./client";
import type { BroadcastDelivery, Campaign } from "@/types";

export const broadcastApi = {
  send: async (
    eventId: string,
    data: {
      campaign_name?: string;
      message: string;
      channel?: string;
      target?: string;
      guest_category?: string;
    },
  ): Promise<{ sent: number; failed: number; campaign_id: string }> => {
    const res = await apiClient.post(`/events/${eventId}/broadcast`, data);
    return res.data.data;
  },

  list: async (eventId: string): Promise<Campaign[]> => {
    const res = await apiClient.get(`/events/${eventId}/broadcasts`);
    return res.data.data;
  },

  deliveries: async (
    eventId: string,
    campaignId: string,
  ): Promise<BroadcastDelivery[]> => {
    const res = await apiClient.get(
      `/events/${eventId}/broadcasts/${campaignId}/deliveries`,
    );
    return res.data.data;
  },
};
