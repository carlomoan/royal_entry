// ==============================================================================
// FILE: src/pages/platform/PlatformRbac.tsx
// ==============================================================================
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { PLATFORM_ROLES, roleLabel } from "@/utils/roles";

interface RolePermission {
  role: string;
  permissions: string[];
}

const FULL_ROLES: RolePermission[] = [
  ...PLATFORM_ROLES.map((r) => ({ role: r, permissions: ["*:*"] })),
  { role: "account_admin", permissions: ["events:*", "guests:*", "invitations:*", "scanner:*", "michango:*", "broadcast:*", "payments:*", "reports:*", "audit:*", "team:*", "settings:*"] },
  { role: "event_manager", permissions: ["events:read", "events:write", "guests:*", "invitations:*", "scanner:*", "broadcast:*"] },
  { role: "event_accountant", permissions: ["events:read", "michango:*", "payments:*"] },
  { role: "secretary", permissions: ["events:read", "guests:*", "broadcast:read", "invitations:*"] },
  { role: "scanner_attendant", permissions: ["events:read", "scanner:*"] },
  { role: "viewer", permissions: ["events:read", "reports:read"] },
];

export default function PlatformRbac() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Roles & Permissions
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          System-wide RBAC matrix. Platform roles inherit all permissions.
        </p>
      </div>

      <div className="space-y-4">
        {FULL_ROLES.map(({ role, permissions }) => (
          <Card key={role} title={roleLabel(role)}>
            <div className="flex flex-wrap gap-2">
              {permissions.map((perm) => (
                <Badge
                  key={perm}
                  label={perm}
                  variant={perm === "*:*" ? "gold" : perm.endsWith(":*") ? "blue" : "slate"}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}