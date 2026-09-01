"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import api from "@/lib/api";
import { Card, Badge } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/utils";

export default function AuditPage() {
  const { data: response, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await api.get("/audit/logs")).data,
  });
  const logs = (response?.data ?? []) as any[];

  const columns: ColumnDef<any>[] = [
    { key: "occurred_at", label: "Time", sortable: true, render: (l) => <span className="text-xs text-slate-500">{formatDate(l.occurred_at)}</span> },
    { key: "user_email", label: "User", sortable: true, render: (l) => <span className="text-slate-700">{l.user_email ?? "—"}</span> },
    { key: "method", label: "Method", render: (l) => <span className="font-mono text-xs text-slate-600">{l.method}</span> },
    { key: "path", label: "Path", render: (l) => <span className="font-mono text-xs text-slate-600">{l.path}</span> },
    {
      key: "status_code",
      label: "Status",
      sortable: true,
      render: (l) => <Badge label={l.status_code >= 400 ? "error" : "success"} variant={l.status_code >= 400 ? "rose" : "green"} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Security trail of every authenticated action</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : logs.length === 0 ? (
        <Card><div className="py-12 text-center"><ScrollText className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No audit entries</p></div></Card>
      ) : (
        <Card title="Recent Activity">
          <DataTable
            data={logs}
            columns={columns}
            searchPlaceholder="Search audit logs by user, method, or path..."
            searchFields={["user_email", "method", "path"]}
            sortField="occurred_at"
            sortDir="desc"
            pageSize={20}
            emptyMessage="No audit entries"
          />
        </Card>
      )}
    </div>
  );
}
