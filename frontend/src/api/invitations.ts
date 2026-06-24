// ==============================================================================
// FILE: src/api/invitations.ts
// ==============================================================================
import { apiClient } from "./client";
import type { Invitation, GenerateResult } from "@/types";

export const invitationsApi = {
  generate: async (
    eventId: string,
    overwrite = false,
  ): Promise<GenerateResult> => {
    const res = await apiClient.post(
      `/events/${eventId}/invitations/generate`,
      { overwrite },
    );
    return res.data.data;
  },

  list: async (eventId: string): Promise<Invitation[]> => {
    const res = await apiClient.get(`/events/${eventId}/invitations`);
    return res.data.data;
  },
};
