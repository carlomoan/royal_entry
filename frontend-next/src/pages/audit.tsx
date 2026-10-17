"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

export default function AuditPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const exportAudit = async () => {
    try {
      const response = await api.get("/audit/export", { params: { action: actionFilter || undefined } });
      const { filename, content } = response.data.data;
      const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Audit export failed"); }
  };
  const { data: response, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit", actionFilter, page],
    queryFn: async () => (await api.get("/audit/logs", { params: { page, per_page: 25, action: actionFilter || undefined } })).data,
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500">Security trail · {response?.pagination?.total ?? logs.length} records</p>
        </div>
        <div className="flex gap-2">
          <input aria-label="Filter audit action" value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }} placeholder="Filter actions" className="h-9 rounded-lg border border-slate-200 px-3 text-sm" />
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportAudit}><Download className="h-3.5 w-3.5" /> Export CSV</Button>
        </div>
      </div>

      {isError && <Card><p className="text-sm text-rose-700">Audit records could not be loaded. Check access or retry.</p></Card>}
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
      {!isLoading && <div className="flex items-center justify-between text-xs text-slate-500"><span>Page {response?.pagination?.page ?? page} of {response?.pagination?.total_pages ?? 1}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><Button size="sm" variant="outline" disabled={page >= (response?.pagination?.total_pages ?? 1)} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>}
    </div>
  );
}
