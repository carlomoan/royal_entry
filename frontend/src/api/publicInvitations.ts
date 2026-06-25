import axios from "axios";
import type { PublicInvitationData } from "@/types";

const PUBLIC_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

const publicApiClient = axios.create({
  baseURL: PUBLIC_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export const publicInvitationsApi = {
  get: async (code: string): Promise<PublicInvitationData> => {
    const res = await publicApiClient.get(`/public/invitations/${code}`);
    return res.data.data;
  },

  submitRsvp: async (
    code: string,
    response: "confirmed" | "declined" | "pending",
  ): Promise<PublicInvitationData> => {
    const res = await publicApiClient.post(`/public/invitations/${code}/rsvp`, {
      response,
    });
    return res.data.data;
  },
};
