// ==============================================================================
// FILE: src/utils/roles.ts
// ==============================================================================
// Frontend RBAC helpers — mirror of backend src/utils/rbac.rs

/** Normalize a role string to lowercase for comparison. */
const normalize = (role?: string): string => (role ?? "").trim().toLowerCase();

/** Platform-wide administrators (system + super admins). */
export const isPlatformAdmin = (role?: string): boolean => {
  const r = normalize(role);
  return r === "admin" || r === "superadmin" || r === "system_admin";
};

/** Account-level administrators (can manage events, reports, audit). */
export const isAccountAdmin = (role?: string): boolean => {
  const r = normalize(role);
  return (
    r === "account_admin" ||
    r === "organizer" ||
    r === "admin" ||
    r === "superadmin" ||
    r === "system_admin"
  );
};

/** Users who can manage team members and roles. */
export const canManageUsers = (role?: string): boolean => {
  const r = normalize(role);
  return (
    r === "account_admin" ||
    r === "admin" ||
    r === "superadmin" ||
    r === "system_admin"
  );
};

/** Roles a given user is allowed to assign to others. */
export const allowedAssignableRoles = (role?: string): string[] => {
  if (isPlatformAdmin(role)) {
    return [
      "system_admin",
      "superadmin",
      "account_admin",
      "organizer",
      "mc",
      "door_staff",
      "viewer",
    ];
  }
  return ["account_admin", "organizer", "mc", "door_staff", "viewer"];
};

/** Human-readable label for a role key. */
export const roleLabel = (role?: string): string => {
  const r = normalize(role);
  const map: Record<string, string> = {
    system_admin: "System Admin",
    superadmin: "Super Admin",
    admin: "System Admin",
    account_admin: "Account Admin",
    organizer: "Organizer",
    mc: "MC / Event Host",
    door_staff: "Door Staff",
    viewer: "Viewer",
  };
  return map[r] ?? (role ? role.replace(/_/g, " ") : "Team member");
};
