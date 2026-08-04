// src/api/payments.ts
import { apiClient } from "./client";
import type { Payment, PaginatedResponse } from "@/types";

export const paymentsApi = {
  list: (page = 1, perPage = 20, status?: string): Promise<PaginatedResponse<Payment>> =>
    apiClient
      .get("/payments", { params: { page, per_page: perPage, status } })
      .then((r) => r.data),

  summary: () =>
    apiClient.get("/payments/summary").then((r) => r.data) as Promise<{
      total_revenue_tsh: number;
      completed_count: number;
      pending_count: number;
      failed_count: number;
    }>,

  export: (format: "csv" | "xlsx") =>
    apiClient.get("/payments/export", {
      params: { format },
      responseType: "blob",
    }),
};
