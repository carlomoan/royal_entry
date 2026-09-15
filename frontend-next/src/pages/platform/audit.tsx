// ==============================================================================
// FILE: src/lib/roles.ts
// ==============================================================================
// Single source of truth for frontend role logic.
// MUST mirror backend src/utils/rbac.rs exactly.
// ==============================================================================

export const PLATFORM_ROLES = ["superadmin", "platform_admin", "system_admin"] as const;

export const ACCOUNT_ROLES = [
  "account_admin",
  "event_manager",
  "event_accountant",
  "secretary",
  "scanner_attendant",
  "viewer",
] as const;

export type Role =
  | (typeof ACCOUNT_ROLES)[number]
  | (typeof PLATFORM_ROLES)[number];

const normalize = (role?: string | null): string => (role ?? "").trim().toLowerCase();

// ✅ Platform admins bypass everything
export const isPlatformAdmin = (role?: string | null): boolean =>
  (PLATFORM_ROLES as readonly string[]).includes(normalize(role));

export const isAccountAdmin = (role?: string | null): boolean =>
  normalize(role) === "account_admin" || isPlatformAdmin(role);

export const canManageUsers = (role?: string | null): boolean => isAccountAdmin(role);

export const allowedAssignableRoles = (role?: string | null): string[] => {
  if (isPlatformAdmin(role)) return [...PLATFORM_ROLES, ...ACCOUNT_ROLES];
  if (isAccountAdmin(role)) return [...ACCOUNT_ROLES];
  return [];
};

export const roleLabel = (role?: string | null): string => {
  const r = normalize(role);
  const map: Record<string, string> = {
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
  return map[r] ?? (role ? role.replace(/_/g, " ") : "Team member");
}

// ==============================================================================
// ✅ FIXED PERMISSION MATRIX
// Wildcards MUST be "resource:*" — the old "resource:" form never matched,
// which hid nav items and caused 403s for account roles.
// Mirrors backend src/utils/rbac.rs ROLE_PERMISSIONS.
// ==============================================================================
const ROLE_PERMISSIONS: Record<string, string[]> = {
  account_admin: [
    "events:*", "guests:*", "invitations:*", "scanner:*", "michango:*",
    "broadcast:*", "payments:*", "reports:*", "audit:*", "team:*",
    "settings:*", "invoices:read",
  ],
  event_manager: [
    "events:read", "events:write",
    "guests:*", "invitations:*", "scanner:*", "broadcast:*",
  ],
  event_accountant: [
    "events:read", "michango:*", "payments:*", "reports:read",
  ],
  secretary: [
    "events:read", "guests:*", "broadcast:read", "invitations:*",
  ],
  scanner_attendant: [
    "events:read", "scanner:*",
  ],
  viewer: [
    "events:read", "reports:read",
  ],
};

export function can(role: string | undefined | null, permission: string): boolean {
  const r = normalize(role);
  if (!r) return false;
  if (isPlatformAdmin(r)) return true; // platform roles bypass all checks

  const allowed = ROLE_PERMISSIONS[r] ?? [];
  const [resource] = permission.split(":");
  return allowed.some(
    (p) =>
      p === permission ||          // exact match  "events:read"
      p === `${resource}:*` ||     // wildcard     "events:*"
      p === `${resource}:`         // legacy safety net
  );
}
