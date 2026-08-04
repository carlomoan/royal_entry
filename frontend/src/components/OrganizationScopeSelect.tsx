import { useQuery } from "@tanstack/react-query";
import { platformApi } from "@/api/platform";
import { useAuth } from "@/context/useAuth";
import { isPlatformAdmin } from "@/utils/roles";

export default function OrganizationScopeSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const { user } = useAuth();
  const isPlatform = isPlatformAdmin(user?.role);

  const { data: customers } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: () => platformApi.customers(),
    enabled: isPlatform,
  });

  if (!isPlatform) return null;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
    >
      <option value="">All organizations</option>
      {customers?.map((c) => (
        <option key={c.organization_id} value={c.organization_id}>
          {c.display_name}
        </option>
      ))}
    </select>
  );
}
