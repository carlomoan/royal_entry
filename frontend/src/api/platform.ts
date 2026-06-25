import { apiClient } from "./client";
import type {
  PlatformCustomer,
  PlatformCustomerDetail,
  PlatformInvoice,
  PlatformPlan,
  PlatformSubscription,
  PlatformSummary,
} from "@/types";

export const platformApi = {
  summary: async (): Promise<PlatformSummary> => {
    const res = await apiClient.get("/platform/summary");
    return res.data.data;
  },

  plans: async (): Promise<PlatformPlan[]> => {
    const res = await apiClient.get("/platform/plans");
    return res.data.data;
  },

  customers: async (): Promise<PlatformCustomer[]> => {
    const res = await apiClient.get("/platform/customers");
    return res.data.data;
  },

  customerDetail: async (
    organizationId: string,
  ): Promise<PlatformCustomerDetail> => {
    const res = await apiClient.get(`/platform/customers/${organizationId}`);
    return res.data.data;
  },

  updateCustomerStatus: async (
    organizationId: string,
    isActive: boolean,
  ): Promise<void> => {
    await apiClient.put(`/platform/customers/${organizationId}`, {
      is_active: isActive,
    });
  },

  updateCustomerSubscription: async (
    organizationId: string,
    payload: {
      plan_id: string;
      status: string;
      create_invoice?: boolean;
      due_in_days?: number;
    },
  ): Promise<PlatformSubscription> => {
    const res = await apiClient.put(
      `/platform/customers/${organizationId}/subscription`,
      payload,
    );
    return res.data.data;
  },

  createCustomerInvoice: async (
    organizationId: string,
    payload?: {
      plan_id?: string;
      due_in_days?: number;
      notes?: string;
    },
  ): Promise<PlatformInvoice> => {
    const res = await apiClient.post(
      `/platform/customers/${organizationId}/invoices`,
      payload ?? {},
    );
    return res.data.data;
  },

  markInvoicePaid: async (
    invoiceId: string,
    payload?: {
      payment_method?: string;
      payer_phone?: string;
      notes?: string;
    },
  ): Promise<void> => {
    await apiClient.post(
      `/platform/invoices/${invoiceId}/mark-paid`,
      payload ?? {},
    );
  },
};
