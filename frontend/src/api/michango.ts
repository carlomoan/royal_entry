// ==============================================================================
// FILE: src/api/michango.ts
// ==============================================================================
import { apiClient } from "./client";
import type { Pledge, MichangoSummary, ReminderDelivery } from "@/types";

export const michangoApi = {
  list: async (eventId: string, status?: string): Promise<Pledge[]> => {
    const res = await apiClient.get(`/events/${eventId}/michango`, {
      params: status ? { status } : {},
    });
    return res.data.data;
  },

  summary: async (eventId: string): Promise<MichangoSummary> => {
    const res = await apiClient.get(`/events/${eventId}/michango/summary`);
    return res.data.data;
  },

  addPledge: async (
    eventId: string,
    data: {
      guest_id: string;
      pledged_amount: number;
      payment_deadline?: string;
      notes?: string;
    },
  ): Promise<Pledge> => {
    const res = await apiClient.post(`/events/${eventId}/michango`, data);
    return res.data.data;
  },

  recordPayment: async (
    eventId: string,
    pledgeId: string,
    data: {
      amount_paid: number;
      payment_method?: string;
      payment_reference?: string;
      notes?: string;
    },
  ): Promise<void> => {
    await apiClient.post(
      `/events/${eventId}/michango/${pledgeId}/payment`,
      data,
    );
  },

  sendReminders: async (
    eventId: string,
    statuses?: string[],
    customMessage?: string,
  ): Promise<{ sent: number; failed: number; message: string }> => {
    const res = await apiClient.post(`/events/${eventId}/michango/reminders`, {
      statuses,
      custom_message: customMessage,
    });
    return res.data.data;
  },

  reminderHistory: async (eventId: string): Promise<ReminderDelivery[]> => {
    const res = await apiClient.get(`/events/${eventId}/michango/reminders`);
    return res.data.data;
  },
};
