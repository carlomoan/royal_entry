"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";
import { credStore, CredKeys } from "./credentialStore";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  organization_id?: string | null;
  organization_name?: string;
  created_at: string;
}

function tokenRole(token: string | null): string | null {
  if (!token) return null;
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof payload.role === "string" ? payload.role.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonating: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  startImpersonation: (orgId: string) => Promise<void>;
  returnToSuperAdmin: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isImpersonating: false,
  login: async () => {},
  logout: () => {},
  startImpersonation: async () => {},
  returnToSuperAdmin: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      const currentUser = res.data.data ?? res.data;
      const [accessToken, refreshToken, impersonationToken] = await Promise.all([
        credStore.get(CredKeys.ACCESS_TOKEN),
        credStore.get(CredKeys.REFRESH_TOKEN),
        credStore.get(CredKeys.IMPERSONATION_ORIGINAL_TOKEN),
      ]);
      const accessRole = tokenRole(accessToken);

      if (
        accessRole &&
        !impersonationToken &&
        accessRole !== String(currentUser.role ?? "").trim().toLowerCase() &&
        refreshToken
      ) {
        const refreshed = await api.post("/auth/refresh", { refresh_token: refreshToken });
        await credStore.set(CredKeys.ACCESS_TOKEN, refreshed.data.access_token);
        await credStore.set(CredKeys.REFRESH_TOKEN, refreshed.data.refresh_token);
      }

      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await credStore.get(CredKeys.ACCESS_TOKEN);
      if (token) {
        const imp = await credStore.get(CredKeys.IMPERSONATION_ORIGINAL_TOKEN);
        setIsImpersonating(!!imp);
        await fetchMe();
      }
      setIsLoading(false);
    })();
  }, [fetchMe]);

  const login = useCallback(async (loginId: string, password: string) => {
    const res = await api.post("/auth/login", { login: loginId, password });
    await credStore.set(CredKeys.ACCESS_TOKEN, res.data.access_token);
    await credStore.set(CredKeys.REFRESH_TOKEN, res.data.refresh_token);
    await credStore.remove(CredKeys.IMPERSONATION_ORIGINAL_TOKEN);
    setIsImpersonating(false);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    (async () => {
      await credStore.remove(CredKeys.ACCESS_TOKEN);
      await credStore.remove(CredKeys.REFRESH_TOKEN);
      await credStore.remove(CredKeys.IMPERSONATION_ORIGINAL_TOKEN);
      setIsImpersonating(false);
      setUser(null);
      window.location.href = "/login";
    })();
  }, []);

  const startImpersonation = useCallback(async (orgId: string) => {
    const currentToken = await credStore.get(CredKeys.ACCESS_TOKEN);
    if (currentToken) {
      await credStore.set(CredKeys.IMPERSONATION_ORIGINAL_TOKEN, currentToken);
    }
    const res = await api.post(`/platform/organizations/${orgId}/impersonate`);
    await credStore.set(CredKeys.ACCESS_TOKEN, res.data.data.access_token);
    setIsImpersonating(true);
    window.location.href = "/dashboard";
  }, []);

  const returnToSuperAdmin = useCallback(() => {
    (async () => {
      const originalToken = await credStore.get(CredKeys.IMPERSONATION_ORIGINAL_TOKEN);
      if (originalToken) {
        await credStore.set(CredKeys.ACCESS_TOKEN, originalToken);
        await credStore.remove(CredKeys.IMPERSONATION_ORIGINAL_TOKEN);
        setIsImpersonating(false);
        window.location.href = "/platform";
      }
    })();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isImpersonating,
        login,
        logout,
        startImpersonation,
        returnToSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
