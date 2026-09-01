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

const normalize = (role?: string): string =>
  (role ?? "").trim().toLowerCase();

export const isPlatformAdmin = (role?: string): boolean =>
  PLATFORM_ROLES.includes(normalize(role) as (typeof PLATFORM_ROLES)[number]);

export const isAccountAdmin = (role?: string): boolean =>
  normalize(role) === "account_admin" || isPlatformAdmin(role);

export const canManageUsers = (role?: string): boolean => isAccountAdmin(role);

export const allowedAssignableRoles = (role?: string): string[] => {
  if (isPlatformAdmin(role)) return [...PLATFORM_ROLES, ...ACCOUNT_ROLES];
  if (isAccountAdmin(role)) return [...ACCOUNT_ROLES];
  return [];
};

export const roleLabel = (role?: string): string => {
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
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  account_admin: [
    "events:*", "guests:*", "invitations:*", "scanner:*", "michango:*",
    "broadcast:*", "payments:*", "reports:*", "audit:*", "team:*", "settings:*",
  ],
  event_manager: ["events:read", "events:write", "guests:*", "invitations:*", "scanner:*", "broadcast:*"],
  event_accountant: ["events:read", "michango:*", "payments:*"],
  secretary: ["events:read", "guests:*", "broadcast:read", "invitations:*"],
  scanner_attendant: ["scanner:*"],
  viewer: ["events:read", "reports:read"],
};

export function can(role: string | undefined, permission: string): boolean {
  if (!role) return false;
  if (isPlatformAdmin(role)) return true;
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  const [resource] = permission.split(":");
  return allowed.some((p) => p === permission || p === `${resource}:*`);
}