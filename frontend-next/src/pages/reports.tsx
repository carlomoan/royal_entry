"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Banknote, BarChart3, CalendarDays, CreditCard, Download, Radio, Users } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, StatCard, Button } from "@/components/ui";
import { formatTZS } from "@/lib/utils";

export default function ReportsPage() {
  const reportTypes = ["events", "guests", "payments", "michango", "broadcasts"];
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
    } catch { toast.error("Report export failed"); }
  };
  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => (await api.get("/reports/summary")).data.data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Workspace summaries and exports</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
      </div>

      {isError && <Card><p className="text-sm text-rose-700">Report summary failed to load. Check report permissions or refresh.</p></Card>}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard title="Events" value={summary?.total_events ?? 0} icon={CalendarDays} color="blue" />
            <StatCard title="Guests" value={summary?.total_guests ?? 0} icon={Users} color="purple" />
            <StatCard title="Arrivals" value={summary?.total_arrivals ?? 0} icon={Activity} color="green" />
            <StatCard title="Payments" value={formatTZS(summary?.total_payments_tsh ?? 0)} icon={CreditCard} color="gold" />
            <StatCard title="Michango" value={formatTZS(summary?.total_michango_tsh ?? 0)} icon={Banknote} color="red" />
            <StatCard title="Broadcasts" value={summary?.total_broadcasts ?? 0} icon={Radio} color="blue" />
          </div>
          <Card title="Export data" action={<span className="text-xs text-slate-400">CSV · Current workspace scope</span>}>
            <div className="flex flex-wrap gap-2">
              {reportTypes.map((report) => (
                <Button key={report} variant="outline" size="sm" onClick={() => downloadReport(report)}>
                  <Download className="h-3.5 w-3.5" /> {report === "michango" ? "Michango" : report[0].toUpperCase() + report.slice(1)} CSV
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}