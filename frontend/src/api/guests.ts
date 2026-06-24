// ==============================================================================
// FILE: src/api/guests.ts
// ==============================================================================
import { apiClient } from "./client";
import type {
  Guest,
  GuestWithRsvp,
  CreateGuestInput,
  PaginatedResponse,
} from "@/types";

export const guestsApi = {
  list: async (
    eventId: string,
    page = 1,
    perPage = 20,
    withRsvp = false,
  ): Promise<PaginatedResponse<GuestWithRsvp>> => {
    const res = await apiClient.get(`/events/${eventId}/guests`, {
      params: { page, per_page: perPage, with_rsvp: withRsvp },
    });
    return res.data;
  },

  count: async (eventId: string): Promise<number> => {
    const res = await apiClient.get(`/events/${eventId}/guests/count`);
    return res.data.data.total;
  },

  add: async (eventId: string, data: CreateGuestInput): Promise<Guest> => {
    const res = await apiClient.post(`/events/${eventId}/guests`, data);
    return res.data.data;
  },

  bulkAdd: async (
    eventId: string,
    guests: CreateGuestInput[],
  ): Promise<Guest[]> => {
    const res = await apiClient.post(`/events/${eventId}/guests/bulk`, {
      guests,
    });
    return res.data.data;
  },

  update: async (
    eventId: string,
    guestId: string,
    data: Partial<CreateGuestInput>,
  ): Promise<Guest> => {
    const res = await apiClient.put(
      `/events/${eventId}/guests/${guestId}`,
      data,
    );
    return res.data.data;
  },

  remove: async (eventId: string, guestId: string): Promise<void> => {
    await apiClient.delete(`/events/${eventId}/guests/${guestId}`);
  },
};
