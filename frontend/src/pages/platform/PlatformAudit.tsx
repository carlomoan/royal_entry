// ==============================================================================
// FILE: src/pages/platform/PlatformAudit.tsx
// ==============================================================================
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { auditApi } from "@/api/audit";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/utils/format";

export default function PlatformAudit() {
  const { data: response, isLoading } = useQuery({
    queryKey: ["platform-audit"],
    queryFn: () => auditApi.list({}),
  });

  const logs = response?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
        <p className="text-sm text-slate-600 mt-1">
          System-wide activity trail across all organizations.
        </p>
      </div>

      <Card title="Recent activity">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading audit log…</p>
        ) : !logs || logs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No audit entries yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Time", "User", "Role", "Method", "Path", "Status", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.occurred_at)}</td>
                    <td className="px-4 py-3 text-gray-700">{log.user_email ?? "—"}</td>
                    <td className="px-4 py-3"><Badge label={log.role ?? "—"} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[200px] truncate">{log.path}</td>
                    <td className="px-4 py-3">
                      <Badge label={log.status_code >= 400 ? "error" : "success"} variant={log.status_code >= 400 ? "rose" : "green"} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}