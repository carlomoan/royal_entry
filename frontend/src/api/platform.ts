// src/api/platform.ts
import { apiClient } from "./client";
import type {
  PlatformSummary,
  PlatformCustomer,
  PlatformPlan,
  PlatformCustomerDetail,
} from "@/types";

export interface CreateOrganizationPayload {
  display_name: string;
  account_slug?: string;
  billing_email?: string;
  contact_phone?: string;
  admin: {
    email: string;
    full_name: string;
    phone?: string;
    password: string;
  };
  plan_id?: string;
  auto_approve?: boolean;
}

export interface CreatePlanPayload {
  code: string;
  name: string;
  description?: string;
  price_tsh: number;
  billing_interval: string;
  max_users?: number;
  max_events?: number;
}

export interface UpdatePlanPayload {
  name?: string;
  description?: string;
  price_tsh?: number;
  billing_interval?: string;
  max_users?: number | null;
  max_events?: number | null;
  is_active?: boolean;
}

export interface CreatePlatformUserPayload {
  organization_id: string;
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: string;
}

export interface UpdatePlatformUserPayload {
  email?: string;
  role?: string;
  is_active?: boolean;
  full_name?: string;
  phone?: string;
}

export interface CreateWebhookPayload {
  url: string;
  events: string[];
}

export interface UpdateWebhookPayload {
  url?: string;
  events?: string[];
  is_active?: boolean;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export const platformApi = {
  summary: () =>
    apiClient.get("/platform/summary").then((r) => r.data.data) as Promise<PlatformSummary>,

  customers: () =>
    apiClient
      .get("/platform/customers")
      .then((r) => r.data.data) as Promise<PlatformCustomer[]>,

  customerDetail: (orgId: string) =>
    apiClient
      .get(`/platform/customers/${orgId}`)
      .then((r) => r.data.data) as Promise<PlatformCustomerDetail>,

  plans: () =>
    apiClient.get("/platform/plans").then((r) => r.data.data) as Promise<PlatformPlan[]>,

  createPlan: (payload: CreatePlanPayload) =>
    apiClient
      .post("/platform/plans", payload)
      .then((r) => r.data.data) as Promise<PlatformPlan>,

  updatePlan: (planId: string, payload: UpdatePlanPayload) =>
    apiClient
      .put(`/platform/plans/${planId}`, payload)
      .then((r) => r.data.data) as Promise<PlatformPlan>,

  deletePlan: (planId: string) =>
    apiClient.delete(`/platform/plans/${planId}`).then((r) => r.data),

  approveAccount: (orgId: string) =>
    apiClient.post(`/platform/customers/${orgId}/approve`).then((r) => r.data),

  rejectAccount: (orgId: string) =>
    apiClient.post(`/platform/customers/${orgId}/reject`).then((r) => r.data),

  suspendAccount: (orgId: string) =>
    apiClient.post(`/platform/customers/${orgId}/suspend`).then((r) => r.data),

  // ── Platform user management ────────────────────────────────────────
  listUsers: () =>
    apiClient.get("/platform/users").then((r) => r.data.data) as Promise<any[]>,

  createUser: (payload: CreatePlatformUserPayload) =>
    apiClient
      .post("/platform/users", payload)
      .then((r) => r.data.data) as Promise<any>,

  updateUser: (userId: string, payload: UpdatePlatformUserPayload) =>
    apiClient
      .put(`/platform/users/${userId}`, payload)
      .then((r) => r.data.data) as Promise<any>,

  deleteUser: (userId: string) =>
    apiClient.delete(`/platform/users/${userId}`).then((r) => r.data),

  // ── NEW: Manual organization creation ─────────────────────────────
  createOrganization: (payload: CreateOrganizationPayload) =>
    apiClient
      .post("/platform/organizations", payload)
      .then((r) => r.data) as Promise<{
      organization_id: string;
      admin_user_id: string;
      status: string;
    }>,

  // ── Webhook management ──────────────────────────────────────────────
  listWebhooks: () =>
    apiClient.get("/platform/webhooks").then((r) => r.data.data) as Promise<any[]>,

  createWebhook: (payload: { url: string; events: string[] }) =>
    apiClient
      .post("/platform/webhooks", payload)
      .then((r) => r.data.data) as Promise<any>,

  updateWebhook: (id: string, payload: { url?: string; events?: string[]; is_active?: boolean }) =>
    apiClient
      .put(`/platform/webhooks/${id}`, payload)
      .then((r) => r.data.data) as Promise<any>,

  deleteWebhook: (id: string) =>
    apiClient.delete(`/platform/webhooks/${id}`).then((r) => r.data),

  testWebhook: (id: string) =>
    apiClient.post(`/platform/webhooks/${id}/test`).then((r) => r.data),

  // ── Usage metrics ────────────────────────────────────────────────────
  getUsageMetrics: (orgId: string) =>
    apiClient.get(`/platform/organizations/${orgId}/usage`).then((r) => r.data.data) as Promise<any>,

  getUsageMetricsWithLimits: (orgId: string) =>
    apiClient.get(`/platform/organizations/${orgId}/usage/limits`).then((r) => r.data.data) as Promise<any>,

  trackUsage: (orgId: string, metric: string, delta: number) =>
    apiClient.post(`/platform/organizations/${orgId}/usage/track`, { metric, delta }).then((r) => r.data),

  // ── Organization impersonation ───────────────────────────────────────
  impersonateOrganization: (orgId: string) =>
    apiClient.post(`/platform/organizations/${orgId}/impersonate`).then((r) => r.data),

  // ── Additional account actions ────────────────────────────────────────
  reactivateAccount: (orgId: string) =>
    apiClient.post(`/platform/customers/${orgId}/reactivate`).then((r) => r.data),

  deleteAccount: (orgId: string) =>
    apiClient.delete(`/platform/customers/${orgId}`).then((r) => r.data),

  // ── Global variables ──────────────────────────────────────────────────
  listGlobalVariables: () =>
    apiClient.get("/platform/global-variables").then((r) => r.data.data) as Promise<any[]>,

  createGlobalVariable: (payload: { key: string; value: string; description?: string }) =>
    apiClient.post("/platform/global-variables", payload).then((r) => r.data.data) as Promise<any>,

  updateGlobalVariable: (id: string, payload: { value: string; description?: string }) =>
    apiClient.put(`/platform/global-variables/${id}`, payload).then((r) => r.data.data) as Promise<any>,

  deleteGlobalVariable: (id: string) =>
    apiClient.delete(`/platform/global-variables/${id}`).then((r) => r.data),

  // ── Card templates (platform-level) ───────────────────────────────────
  listCardTemplates: () =>
    apiClient.get("/platform/card-templates").then((r) => r.data.data) as Promise<any[]>,

  createCardTemplate: (payload: {
    name: string;
    description?: string;
    theme_config: Record<string, unknown>;
    preview_image_url?: string;
  }) =>
    apiClient.post("/platform/card-templates", payload).then((r) => r.data.data) as Promise<any>,

  updateCardTemplate: (id: string, payload: {
    name?: string;
    description?: string;
    theme_config?: Record<string, unknown>;
    preview_image_url?: string;
    is_active?: boolean;
  }) =>
    apiClient.put(`/platform/card-templates/${id}`, payload).then((r) => r.data.data) as Promise<any>,

  deleteCardTemplate: (id: string) =>
    apiClient.delete(`/platform/card-templates/${id}`).then((r) => r.data),
};