// ==============================================================================
// FILE: src/components/OrganizationScopeSelect.tsx
// ==============================================================================
// Organization scope selector for platform admins (SaaS cross-tenant filtering).
// Account-level users are auto-scoped by the backend and don't see this control.

import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { platformApi } from "@/api/platform";
import { isPlatformAdmin } from "@/utils/roles";
import { useAuth } from "@/context/useAuth";

interface Props {
  value?: string;
  onChange: (organizationId: string | undefined) => void;
  className?: string;
}

export default function OrganizationScopeSelect({
  value,
  onChange,
  className,
}: Props) {
  const { user } = useAuth();
  const { data: customers } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: () => platformApi.customers(),
    enabled: isPlatformAdmin(user?.role),
  });

  // Not a platform admin — backend scopes automatically, render nothing.
  if (!isPlatformAdmin(user?.role)) return null;
  if (!customers || customers.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Building2 className="h-4 w-4 text-gold-600" />
      <label className="text-xs font-medium text-gray-600">Scope</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gold-400"
      >
        <option value="">All organizations</option>
        {customers.map((c) => (
          <option key={c.organization_id} value={c.organization_id}>
            {c.display_name}
          </option>
        ))}
      </select>
    </div>
  );
}
