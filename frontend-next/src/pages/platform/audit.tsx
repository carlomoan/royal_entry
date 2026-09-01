"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollText, Trash2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const RETENTION_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "0", label: "Delete all" },
];

export default function PlatformAuditPage() {
  const qc = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetDays, setResetDays] = useState("90");

  const { data: response, isLoading } = useQuery({
    queryKey: ["platform-audit"],
    queryFn: async () => (await api.get("/audit/logs")).data,
  });
  const logs = response?.data ?? [];

  const resetMutation = useMutation({
    mutationFn: (days: number) => api.delete(`/audit/reset?days=${days}`),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["platform-audit"] });
      setResetOpen(false);
      toast.success(r.data?.message ?? "Audit logs purged");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to purge"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500">System-wide activity trail</p>
        </div>
        <Button variant="outline" onClick={() => setResetOpen(true)}>
          <Trash2 className="h-4 w-4" /> Purge old logs
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : logs.length === 0 ? (
        <Card><div className="py-12 text-center"><ScrollText className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No audit entries</p></div></Card>
      ) : (
        <Card title="Recent Activity">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Time", "User", "Role", "Method", "Path", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(log.occurred_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{log.user_email ?? "—"}</td>
                    <td className="px-4 py-3"><Badge label={log.role ?? "—"} variant="slate" /></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.path}</td>
                    <td className="px-4 py-3"><Badge label={log.status_code >= 400 ? "error" : "success"} variant={log.status_code >= 400 ? "rose" : "green"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reset / purge modal */}
      <Modal isOpen={resetOpen} onClose={() => setResetOpen(false)} title="Purge Audit Logs" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>This action is irreversible. Audit log entries older than the chosen retention window will be permanently deleted.</p>
          </div>
          <Select label="Retention window" value={resetDays} onChange={(e) => setResetDays(e.target.value)}>
            {RETENTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => resetMutation.mutate(parseInt(resetDays))}
              isLoading={resetMutation.isPending}
            >
              <Trash2 className="h-4 w-4" /> Purge
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
