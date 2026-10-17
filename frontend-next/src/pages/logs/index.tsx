"use client";
import { useQuery } from "@tanstack/react-query";
import { FileText, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { Card, Badge } from "@/components/ui";

export default function DeliveryLogsPage() {
  const { data: logs = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ["message-logs"],
    queryFn: async () => {
      const response = await api.get("/message-logs?per_page=100");
      const rows = response.data?.data;
      return Array.isArray(rows) ? rows : [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold text-slate-900">Delivery Logs</h1>
        <p className="text-sm text-slate-500">Message delivery attempts · {logs.length} records loaded</p>
        </div>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {isError && <Card><p className="text-sm text-rose-700">Delivery logs could not be loaded. Retry or check audit permissions.</p></Card>}

      <Card title="Message Deliveries">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No delivery logs yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Event", "Recipient", "Channel", "Status", "Retry", "Time"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{log.event_id?.slice(0, 8) ?? log.campaign_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{log.recipient_name ?? log.recipient_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-3"><Badge label={log.channel} variant="blue" /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        log.status === "sent" ? "bg-emerald-50 text-emerald-600" :
                        log.status === "failed" ? "bg-rose-50 text-rose-600" :
                        "bg-amber-50 text-amber-600"
                      }`}>
                        {log.status === "sent" ? <CheckCircle className="h-3 w-3" /> :
                         log.status === "failed" ? <XCircle className="h-3 w-3" /> :
                         <Clock className="h-3 w-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{log.retry_count ?? 0}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(log.created_at).toLocaleString()}</td>
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
