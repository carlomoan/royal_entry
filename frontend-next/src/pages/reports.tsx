"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import api from "@/lib/api";
import { Card, StatCard } from "@/components/ui";
import { formatTZS } from "@/lib/utils";

export default function ReportsPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => (await api.get("/reports/summary")).data.data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Workspace summaries and exports</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard title="Events" value={summary?.total_events ?? 0} icon={BarChart3} color="blue" />
            <StatCard title="Guests" value={summary?.total_guests ?? 0} icon={BarChart3} color="purple" />
            <StatCard title="Arrivals" value={summary?.total_arrivals ?? 0} icon={BarChart3} color="green" />
            <StatCard title="Payments" value={formatTZS(summary?.total_payments_tsh ?? 0)} icon={BarChart3} color="gold" />
            <StatCard title="Michango" value={formatTZS(summary?.total_michango_tsh ?? 0)} icon={BarChart3} color="red" />
            <StatCard title="Broadcasts" value={summary?.total_broadcasts ?? 0} icon={BarChart3} color="blue" />
          </div>
          <Card title="Summary">
            <p className="text-sm text-slate-500">Detailed report export coming soon.</p>
          </Card>
        </>
      )}
    </div>
  );
}