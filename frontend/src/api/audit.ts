// ==============================================================================
// FILE: src/api/audit.ts
// ==============================================================================
import { apiClient } from "./client";
import type { AuditLog, AuditQuery, PaginatedResponse, ReportExport } from "@/types";

export const auditApi = {
  list: async (query: AuditQuery = {}): Promise<PaginatedResponse<AuditLog>> => {
    const res = await apiClient.get("/audit/logs", { params: query });
    return res.data;
  },

  export: async (query: AuditQuery = {}): Promise<ReportExport> => {
    const res = await apiClient.get("/audit/export", { params: query });
    return res.data.data;
  },
};
