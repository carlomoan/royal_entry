"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity, Banknote, CalendarDays, CreditCard, Download, Radio,
  RefreshCw, Users, FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button } from "@/components/ui";
import { formatTZS } from "@/lib/utils";

const REPORT_TYPES = [
  { key: "events", label: "Events", desc: "Event title, date, venue, status and guest counts" },
  { key: "guests", label: "Guests", desc: "Guest name, phone, email, category, table and arrival status" },
  { key: "payments", label: "Payments", desc: "Payment type, method, amount, status and reference" },
  { key: "michango", label: "Michango", desc: "Guest, pledged, paid, outstanding, payment status and deadline" },
  { key: "broadcasts", label: "Broadcasts", desc: "Campaign, channel, recipients and sent/failed counts" },
];

export default function ReportsPage() {
  const { data: summary, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => (await api.get("/reports/summary")).data.data,
  });

  const downloadReport = async (report: string) => {
    try {
      const response = await api.get(`/reports/export?report=${report}`);
      const { filename, content } = response.data.data;
      const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`${report} report downloaded`);
    } catch {
      toast.error("Report export failed");
    }
  };

  const metrics = [
    { label: "Events", value: summary?.total_events ?? 0, icon: CalendarDays, tint: "bg-sky-100 text-sky-700" },
    { label: "Guests", value: summary?.total_guests ?? 0, icon: Users, tint: "bg-violet-100 text-violet-700" },
    { label: "Arrivals", value: summary?.total_arrivals ?? 0, icon: Activity, tint: "bg-emerald-100 text-emerald-700" },
    { label: "Payments", value: formatTZS(summary?.total_payments_tsh ?? 0), icon: CreditCard, tint: "bg-amber-100 text-amber-700" },
    { label: "Michango", value: formatTZS(summary?.total_michango_tsh ?? 0), icon: Banknote, tint: "bg-rose-100 text-rose-700" },
    { label: "Broadcasts", value: summary?.total_broadcasts ?? 0, icon: Radio, tint: "bg-sky-100 text-sky-700" },
  ];

  const breakdown = [
    { label: "Events", value: summary?.total_events ?? 0, note: "Total events in this workspace" },
    { label: "Guests", value: summary?.total_guests ?? 0, note: "Guests across all events" },
    { label: "Arrivals", value: summary?.total_arrivals ?? 0, note: "Guests checked in at the door" },
    { label: "Payments", value: formatTZS(summary?.total_payments_tsh ?? 0), note: "Total collected via payments" },
    { label: "Michango", value: formatTZS(summary?.total_michango_tsh ?? 0), note: "Total collected from pledges" },
    { label: "Broadcasts", value: summary?.total_broadcasts ?? 0, note: "Broadcast campaigns sent" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Workspace summaries and CSV exports</p>
        </div>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-slate-400">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {isError && (
        <Card>
          <p className="text-sm text-rose-700">
            Report summary failed to load. Check report permissions or refresh.
          </p>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {/* Summary metric cards — full values, no truncation */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {metrics.map(({ label, value, icon: Icon, tint }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tint}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 break-words text-2xl font-extrabold leading-tight text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Breakdown with context */}
          <Card title="Workspace summary" action={<span className="text-xs text-slate-400">Current workspace scope</span>}>
            <div className="divide-y divide-slate-100">
              {breakdown.map((row) => (
                <div key={row.label} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.note}</p>
                  </div>
                  <p className="break-words text-right text-base font-extrabold text-slate-900">{row.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Export cards */}
          <Card title="Export data" action={<span className="text-xs text-slate-400">CSV · Current workspace scope</span>}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {REPORT_TYPES.map((report) => (
                <div key={report.key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      {report.label}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{report.desc}</p>
                  </div>
                  <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => downloadReport(report.key)}>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}