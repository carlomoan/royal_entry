// ==============================================================================
// FILE: src/lib/roles.ts
// ==============================================================================
export const PLATFORM_ROLES: string[] = ["superadmin", "platform_admin", "system_admin"];
export const ACCOUNT_ROLES: string[] = [
  "account_admin",
  "event_manager",
  "event_accountant",
  "secretary",
  "scanner_attendant",
  "viewer",
];

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  platform_admin: "Platform Admin",
  system_admin: "System Admin",
  account_admin: "Account Admin",
  event_manager: "Event Manager",
  event_accountant: "Event Accountant",
  secretary: "Secretary",
  scanner_attendant: "Scanner Attendant",
  viewer: "Viewer",
};

export function normalizeRole(role?: string | null): string {
  return (role ?? "").trim().toLowerCase();
}

export function isPlatformAdmin(role?: string | null): boolean {
  return PLATFORM_ROLES.includes(normalizeRole(role));
}

export function isAccountAdmin(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === "account_admin" || isPlatformAdmin(r);
}

export function roleLabel(role?: string | null): string {
  const r = normalizeRole(role);
  return ROLE_LABELS[r] ?? (r ? r.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Guest");
}

// ✅ FIXED: Wildcards must be "resource:*"
const ROLE_PERMISSIONS: Record<string, string[]> = {
  account_admin: [
    "events:*", "guests:*", "invitations:*", "scanner:*",
    "michango:*", "broadcast:*", "payments:*", "reports:*",
    "audit:*", "team:*", "settings:*",
  ],
  event_manager: [
    "events:read", "events:write",
    "guests:*", "invitations:*", "scanner:*", "broadcast:*",
  ],
  event_accountant: [
    "events:read", "michango:*", "payments:*",
  ],
  secretary: [
    "events:read", "guests:*", "broadcast:read", "invitations:*",
  ],
  scanner_attendant: [
    "scanner:*", // ✅ Removed "events:read" so they are forced to the Scanner Hub
  ],
  viewer: [
    "events:read", "reports:read",
  ],
};

export function can(role: string | undefined | null, permission: string): boolean {
  const r = normalizeRole(role);
  if (isPlatformAdmin(r)) return true; // Platform admins bypass all checks

  const allowed = ROLE_PERMISSIONS[r] ?? [];
  const [resource] = permission.split(":");

  // Check for exact match or wildcard (e.g., "events:*" matches "events:read")
  return allowed.some((p) => p === permission || p === `${resource}:*`);
}
