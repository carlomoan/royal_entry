// ==============================================================================
// FILE: src/api/settings.ts
// ==============================================================================
import { apiClient } from "./client";
import type {
  AccountSettingsResponse,
  CreateAccountUserInput,
  TeamMember,
  UpdateAccountUserInput,
  UserRoleOption,
} from "@/types";

export const settingsApi = {
  roleCatalog: async (): Promise<UserRoleOption[]> => {
    const res = await apiClient.get("/settings/roles");
    return res.data.data;
  },

  getAccount: async (): Promise<AccountSettingsResponse> => {
    const res = await apiClient.get("/settings/account");
    return res.data.data;
  },

  updateAccountSettings: async (
    settings: Record<string, unknown>,
  ): Promise<{ organization: unknown; settings: Record<string, unknown> }> => {
    const res = await apiClient.put("/settings/account", { settings });
    return res.data.data;
  },

  getSystem: async (): Promise<Record<string, unknown>> => {
    const res = await apiClient.get("/settings/system");
    return res.data.data;
  },

  updateSystemSettings: async (
    settings: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const res = await apiClient.put("/settings/system", { settings });
    return res.data.data;
  },

  createUser: async (payload: CreateAccountUserInput): Promise<TeamMember> => {
    const res = await apiClient.post("/settings/users", payload);
    return res.data.data;
  },

  updateUser: async (
    userId: string,
    payload: UpdateAccountUserInput,
  ): Promise<TeamMember> => {
    const res = await apiClient.put(`/settings/users/${userId}`, payload);
    return res.data.data;
  },
};
