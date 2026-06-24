// ==============================================================================
// FILE: src/api/events.ts
// ==============================================================================
import { apiClient } from "./client";
import type {
  Event,
  EventSummary,
  CreateEventInput,
  PaginatedResponse,
} from "@/types";

export const eventsApi = {
  list: async (page = 1, perPage = 20): Promise<PaginatedResponse<Event>> => {
    const res = await apiClient.get("/events", {
      params: { page, per_page: perPage },
    });
    return res.data;
  },

  get: async (id: string): Promise<Event> => {
    const res = await apiClient.get(`/events/${id}`);
    return res.data.data;
  },

  summary: async (id: string): Promise<EventSummary> => {
    const res = await apiClient.get(`/events/${id}/summary`);
    return res.data.data;
  },

  create: async (data: CreateEventInput): Promise<Event> => {
    const res = await apiClient.post("/events", data);
    return res.data.data;
  },

  update: async (
    id: string,
    data: Partial<CreateEventInput>,
  ): Promise<Event> => {
    const res = await apiClient.put(`/events/${id}`, data);
    return res.data.data;
  },

  activate: async (
    id: string,
    entryStart: string,
    entryEnd: string,
  ): Promise<Event> => {
    const res = await apiClient.post(`/events/${id}/activate`, {
      entry_start_time: entryStart,
      entry_end_time: entryEnd,
    });
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/events/${id}`);
  },
};
