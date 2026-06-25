// ==============================================================================
// FILE: src/api/reports.ts
// ==============================================================================
import { apiClient } from "./client";
import type { ReportSummary, ReportExport, ReportKind } from "@/types";

export const reportsApi = {
  summary: async (organizationId?: string): Promise<ReportSummary> => {
    const res = await apiClient.get("/reports/summary", {
      params: organizationId ? { organization_id: organizationId } : {},
    });
    return res.data.data;
  },

  export: async (report: ReportKind, organizationId?: string): Promise<ReportExport> => {
    const res = await apiClient.get("/reports/export", {
      params: { report, ...(organizationId ? { organization_id: organizationId } : {}) },
    });
    return res.data.data;
  },
};
