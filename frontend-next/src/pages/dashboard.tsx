"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import {
  Users, UserCheck, CalendarDays, TrendingUp, Building2, CreditCard,
  Receipt, Banknote, Activity, ArrowUpRight, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isPlatformAdmin, roleLabel } from "@/lib/roles";
import { formatDate, formatTZS, cn } from "@/lib/utils";
import { StatCard, Card, Badge } from "@/components/ui";

export default function DashboardPage() {
  const { user } = useAuth();
  const platform = isPlatformAdmin(user?.role);
  return platform ? <PlatformDashboardWithFallback /> : <AccountDashboard />;
}

function PlatformDashboardWithFallback() {
  const { logout } = useAuth();
  const { data: summary, isLoading, isError } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: async () => {
      try {
        const res = await api.get("/platform/summary");
        return res.data.data;
      } catch (error: any) {
        if (error.response?.status === 403) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
  });

  if (isLoading) return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-slate-100" />)}</div>;
  if (summary === null) {
    return <Card><div className="space-y-3 py-8 text-center"><h1 className="text-lg font-semibold text-slate-900">Platform access needs a fresh session</h1><p className="text-sm text-slate-500">Your profile is recognized as a platform administrator, but this access token is not authorized. Sign out and sign in again to refresh your role.</p><button onClick={logout} className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950">Sign out</button></div></Card>;
  }
  if (isError || !summary) return <Card><p className="py-8 text-center text-sm text-rose-700">Platform overview could not be loaded. Retry the page or check the backend.</p></Card>;

  return <PlatformDashboard summary={summary} />;
}

/* ══════════════════════════════════════════════════════════════════════
   Platform (SaaS) dashboard — DashCode analytics style
   ══════════════════════════════════════════════════════════════════════ */

function PlatformDashboard({ summary }: { summary: any }) {
  const { data: customers = [], isLoading: customersLoading, isError: customersError } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: async () => (await api.get("/platform/customers")).data.data,
    retry: false,
  });

  const chartData = useMemo(
    () =>
      [...customers]
        .sort((a: any, b: any) => b.total_revenue_tsh - a.total_revenue_tsh)
        .slice(0, 6)
        .map((c: any) => ({
          name: c.display_name?.split(" ")[0] ?? "Org",
          revenue: c.total_revenue_tsh ?? 0,
        })),
    [customers]
  );

  const attention = customers.filter(
    (c: any) => c.account_status !== "active"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Overview</h1>
          <p className="text-sm text-slate-500">
            SaaS operations across all customer accounts
          </p>
        </div>
        <Link href="/platform/accounts">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 shadow-sm transition hover:bg-gold-600">
            Manage accounts <ArrowUpRight className="h-4 w-4" />
          </span>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={formatTZS(summary?.total_revenue_tsh ?? 0)} icon={Receipt} color="gold" subtitle={`${summary?.pending_payments ?? 0} pending`} />
        <StatCard title="Customers" value={summary?.total_customers ?? 0} icon={Building2} color="blue" subtitle={`${summary?.active_customers ?? 0} active · ${summary?.suspended_customers ?? 0} suspended`} />
        <StatCard title="MRR" value={formatTZS(summary?.monthly_recurring_revenue_tsh ?? 0)} icon={TrendingUp} color="green" subtitle={`${summary?.active_subscriptions ?? 0} active subs`} />
        <StatCard title="Active Events" value={summary?.active_events ?? 0} icon={CalendarDays} color="purple" subtitle={`${summary?.total_users ?? 0} total users`} />
      </div>

      {customersError && <Card><p className="text-sm text-rose-700">Customer accounts could not be loaded. Check your connection or refresh the dashboard.</p></Card>}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card title="Revenue by Account" className="lg:col-span-2" action={
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Top 6</span>
        }>
          {customersLoading ? <div className="h-[280px] animate-pulse rounded bg-slate-100" /> : chartData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a84c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#c9a84c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#c9a84c" strokeWidth={2.5} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Accounts needing attention */}
        <Card title="Needs Attention">
          {customersLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-slate-100" />)}</div> : attention.length === 0 ? (
            <div className="flex flex-col items-center py-14">
              <UserCheck className="mb-2 h-8 w-8 text-emerald-300" />
              <p className="text-sm text-slate-400">All accounts healthy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attention.slice(0, 5).map((c: any) => (
                <Link key={c.organization_id} href={`/platform/accounts/${c.organization_id}`}
                  className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 transition hover:border-amber-300"
                >
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{c.display_name}</p>
                    <p className="truncate text-[10px] text-slate-500">{c.admin_email}</p>
                  </div>
                  <Badge label={c.account_status} variant="rose" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Customer table */}
      <Card title="Customer Accounts">
        {customersLoading ? <p className="py-6 text-sm text-slate-500">Loading accounts…</p> : <DataTable customers={customers} />}
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Account (tenant) dashboard
   ══════════════════════════════════════════════════════════════════════ */

function AccountDashboard() {
  const { user } = useAuth();
  const { data: eventsData, isLoading: eventsLoading, isError: eventsError } = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get("/events?page=1&per_page=50")).data,
  });
  const events = eventsData?.data ?? [];
  const active = events.filter((e: any) => e.status === "active");
  const upcoming = events.filter((e: any) => e.status === "approved" || e.status === "draft");
  const activeEvent = active[0];

  const { data: reportSummary, isLoading: reportLoading, isError: reportError } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => (await api.get("/reports/summary")).data.data,
  });

  const { data: scanStats, isError: scanError } = useQuery({
    queryKey: ["scan-stats", activeEvent?.id],
    queryFn: async () => (await api.get(`/events/${activeEvent.id}/scan-stats`)).data.data,
    enabled: !!activeEvent,
    refetchInterval: 10_000,
  });

  const { data: eventSummary, isError: eventSummaryError } = useQuery({
    queryKey: ["event-summary", activeEvent?.id],
    queryFn: async () => (await api.get(`/events/${activeEvent.id}/summary`)).data.data,
    enabled: !!activeEvent,
    refetchInterval: 10_000,
  });

  const summary = eventSummary?.summary;
  const timeline = scanStats?.timeline ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Live operations overview · {roleLabel(user?.role)}</p>
      </div>

      {(eventsError || reportError || eventSummaryError || scanError) && <Card><p className="text-sm text-rose-700">Some workspace data is unavailable. Use the links below to open the relevant event or report.</p></Card>}

      {/* Stats */}
      {reportLoading ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />)}</div> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Events" value={reportSummary?.total_events ?? 0} icon={CalendarDays} color="blue" />
        <StatCard title="Guests" value={reportSummary?.total_guests ?? 0} icon={Users} color="purple" />
        <StatCard title="Arrivals" value={reportSummary?.total_arrivals ?? 0} icon={UserCheck} color="green" />
        <StatCard title="Payments" value={formatTZS(reportSummary?.total_payments_tsh ?? 0)} icon={CreditCard} color="gold" />
        <StatCard title="Michango" value={formatTZS(reportSummary?.total_michango_tsh ?? 0)} icon={Banknote} color="red" />
        <StatCard title="Broadcasts" value={reportSummary?.total_broadcasts ?? 0} icon={Activity} color="blue" />
      </div>}

      <Card title="Event Pipeline" action={<Link href="/events" className="text-xs font-semibold text-gold-700 hover:underline">View events</Link>}>
        {eventsLoading ? <p className="text-sm text-slate-500">Loading events…</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Live", count: active.length, className: "bg-emerald-50 text-emerald-800" },
            { label: "Approved", count: events.filter((event: any) => event.status === "approved").length, className: "bg-sky-50 text-sky-800" },
            { label: "Draft", count: events.filter((event: any) => event.status === "draft").length, className: "bg-amber-50 text-amber-800" },
            { label: "Completed", count: events.filter((event: any) => event.status === "completed").length, className: "bg-slate-100 text-slate-800" },
          ].map((item) => <div key={item.label} className={`rounded-lg p-4 ${item.className}`}><p className="text-xs font-semibold uppercase">{item.label}</p><p className="mt-1 text-2xl font-bold">{item.count}</p></div>)}
        </div>}
      </Card>

      {/* Live event banner */}
      {activeEvent ? (
        <div className="relative overflow-hidden rounded-xl bg-navy-950 p-6 text-white shadow-lg animate-fadeIn">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(#c9a84c 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Live Event</span>
              </div>
              <h2 className="text-2xl font-bold">{activeEvent.title}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {activeEvent.venue_name} · {formatDate(activeEvent.event_date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-5xl font-black text-gold-400">{scanStats?.arrived ?? 0}</p>
              <p className="text-sm text-slate-400">guests arrived</p>
            </div>
          </div>
          {scanStats && scanStats.total_guests > 0 && (
            <div className="relative z-10 mt-5">
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>{scanStats.arrival_rate_percent}% arrived</span>
                <span>{scanStats.arrived} / {scanStats.total_guests}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-700"
                  style={{ width: `${scanStats.arrival_rate_percent}%` }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <div className="py-10 text-center">
            <CalendarDays className="mx-auto mb-3 h-12 w-12 text-slate-200" />
            <h3 className="font-semibold text-slate-700">No active events right now</h3>
            <p className="mt-1 text-sm text-slate-500">Activate an event to see live arrivals here.</p>
            <Link href="/events" className="mt-4 inline-block rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-600">
              Go to Events
            </Link>
          </div>
        </Card>
      )}

      {/* Charts + upcoming */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {timeline.length > 0 && (
          <Card title="Arrival Timeline" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={timeline} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="count" name="Arrivals" fill="#c9a84c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {upcoming.length > 0 && (
          <Card title="Upcoming Events" className={cn(timeline.length > 0 && "lg:col-span-1")}>
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((event: any) => (
                <Link key={event.id} href={`/events/${event.id}`}
                  className="group flex items-center justify-between rounded-lg border border-slate-100 p-3.5 transition hover:border-gold-300 hover:bg-gold-50/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-950 text-sm font-bold text-gold-400">
                      {new Date(event.event_date).getDate()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 group-hover:text-gold-700">{event.title}</p>
                      <p className="truncate text-xs text-slate-500">{event.venue_name}</p>
                    </div>
                  </div>
                  <Badge label={event.status} variant="slate" />
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Shared customer table for platform dashboard ──────────────────────── */

function DataTable({ customers }: { customers: any[] }) {
  if (customers.length === 0) {
    return (
      <div className="py-12 text-center">
        <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-200" />
        <p className="font-medium text-slate-600">No customers yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {["Organization", "Admin", "Status", "Users", "Events", "Revenue", "Plan"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map((c: any) => (
            <tr key={c.organization_id} className="transition hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{c.display_name}</td>
              <td className="px-4 py-3 text-slate-500">{c.admin_email}</td>
              <td className="px-4 py-3"><Badge label={c.account_status} /></td>
              <td className="px-4 py-3 text-slate-600">{c.users_count}</td>
              <td className="px-4 py-3 text-slate-600">{c.active_events_count}/{c.events_count}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{formatTZS(c.total_revenue_tsh)}</td>
              <td className="px-4 py-3">
                {c.current_plan_name ? (
                  <span className="text-xs font-semibold text-gold-700">{c.current_plan_name}</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}