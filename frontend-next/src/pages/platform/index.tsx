"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, TrendingUp, CreditCard, CalendarDays, Receipt, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { StatCard, Card, Badge } from "@/components/ui";
import { formatTZS, formatDate } from "@/lib/utils";

export default function PlatformOverviewPage() {
  const { data: summary } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: async () => (await api.get("/platform/summary")).data.data,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: async () => (await api.get("/platform/customers")).data.data,
  });

  const attention = customers.filter((c: any) => c.account_status !== "active");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
          <p className="text-sm text-slate-500">SaaS operations across all customer accounts</p>
        </div>
        <Link href="/platform/accounts" className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-600">
          Manage accounts <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={formatTZS(summary?.total_revenue_tsh ?? 0)} icon={Receipt} color="gold" subtitle={`${summary?.pending_payments ?? 0} pending`} />
        <StatCard title="Customers" value={summary?.total_customers ?? 0} icon={Building2} color="blue" subtitle={`${summary?.active_customers ?? 0} active · ${summary?.suspended_customers ?? 0} suspended`} />
        <StatCard title="MRR" value={formatTZS(summary?.monthly_recurring_revenue_tsh ?? 0)} icon={TrendingUp} color="green" subtitle={`${summary?.active_subscriptions ?? 0} active subs`} />
        <StatCard title="Active Events" value={summary?.active_events ?? 0} icon={CalendarDays} color="purple" subtitle={`${summary?.total_users ?? 0} total users`} />
      </div>

      <Card title="Accounts Needing Attention">
        {attention.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">All accounts are in good standing</p>
        ) : (
          <div className="space-y-3">
            {attention.slice(0, 6).map((c: any) => (
              <Link key={c.organization_id} href="/platform/accounts" className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 transition hover:border-amber-300">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.display_name}</p>
                  <p className="truncate text-xs text-slate-500">{c.admin_email} · {formatDate(c.last_activity_at)}</p>
                </div>
                <Badge label={c.account_status} variant="rose" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card title="Customer Accounts">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200">
              {["Organization", "Admin", "Status", "Users", "Events", "Revenue", "Plan"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c: any) => (
                <tr key={c.organization_id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.display_name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.admin_email}</td>
                  <td className="px-4 py-3"><Badge label={c.account_status} /></td>
                  <td className="px-4 py-3 text-slate-600">{c.users_count}</td>
                  <td className="px-4 py-3 text-slate-600">{c.active_events_count}/{c.events_count}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatTZS(c.total_revenue_tsh)}</td>
                  <td className="px-4 py-3">{c.current_plan_name ? <span className="text-xs font-semibold text-gold-700">{c.current_plan_name}</span> : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}