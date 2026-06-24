// ==============================================================================
// FILE: src/api/auth.ts
// ==============================================================================
import { apiClient } from "./client";
import type { AuthResponse, User } from "@/types";

export const authApi = {
  login: async (login: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post("/auth/login", { login, password });
    return res.data;
  },

  register: async (data: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
  }): Promise<AuthResponse> => {
    const res = await apiClient.post("/auth/register", data);
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get("/auth/me");
    return res.data;
  },

  changePassword: async (data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> => {
    await apiClient.post("/auth/change-password", data);
  },
};
