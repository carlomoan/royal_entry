// Credentials storage abstraction.
// Web (browser): uses standard `localStorage`.
// Tauri (desktop/mobile): also uses `localStorage` (Tauri provides access
// to the same web APIs). The `@tauri-apps/plugin-store` dependency is
// reserved for future OS-keychain migration but is not required for
// the current build to pass.

const ACCESS_TOKEN = "access_token";
const REFRESH_TOKEN = "refresh_token";
const IMPERSONATION_ORIGINAL_TOKEN = "impersonation_original_token";

export const credStore = {
  async get(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  },

  async remove(key: string): Promise<void> {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  },
};

export const CredKeys = {
  ACCESS_TOKEN,
  REFRESH_TOKEN,
  IMPERSONATION_ORIGINAL_TOKEN,
};
