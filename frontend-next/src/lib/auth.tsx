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
      setUser(res.data.data ?? res.data);
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
