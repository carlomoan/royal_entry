// ==============================================================================
// FILE: src/pages/Dashboard.tsx
// ==============================================================================
// Role-aware dashboard.
//  - Platform admins (system_admin / superadmin / admin): SaaS overview
//    (customers, MRR, subscriptions, active events).
//  - Account users: live arrivals dashboard for active events.

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  UserCheck,
  CalendarDays,
  TrendingUp,
  RefreshCw,
  Building2,
  CreditCard,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { eventsApi } from "@/api/events";
import { scannerApi } from "@/api/scanner";
import { platformApi } from "@/api/platform";
import { reportsApi } from "@/api/reports";
import { useAuth } from "@/context/useAuth";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate, formatTZS } from "@/utils/format";
import { isPlatformAdmin } from "@/utils/roles";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();

  if (isPlatformAdmin(user?.role)) {
    return <PlatformDashboard />;
  }
  return <AccountDashboard />;
}

// ── Platform (SaaS) dashboard ─────────────────────────────────────────────────

function PlatformDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: () => platformApi.summary(),
  });

  const { data: customers } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: () => platformApi.customers(),
  });

  const suspended = (customers ?? []).filter(
    (c) => c.account_status !== "active",
  );
  const topByRevenue = [...(customers ?? [])]
    .sort((a, b) => b.total_revenue_tsh - a.total_revenue_tsh)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          SaaS operations across all customer accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Customers"
          value={summary?.total_customers ?? 0}
          subtitle={`${summary?.active_customers ?? 0} active · ${summary?.suspended_customers ?? 0} suspended`}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Monthly Recurring Revenue"
          value={formatTZS(summary?.monthly_recurring_revenue_tsh ?? 0)}
          icon={TrendingUp}
          color="gold"
        />
        <StatCard
          title="Active Subscriptions"
          value={summary?.active_subscriptions ?? 0}
          subtitle={`${summary?.past_due_subscriptions ?? 0} past due`}
          icon={CreditCard}
          color="green"
        />
        <StatCard
          title="Total Revenue"
          value={formatTZS(summary?.total_revenue_tsh ?? 0)}
          subtitle={`${summary?.pending_payments ?? 0} pending payments`}
          icon={Receipt}
          color="purple"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading summary…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top accounts by revenue">
          {topByRevenue.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              No customer accounts yet.
            </p>
          ) : (
            <div className="space-y-3">
              {topByRevenue.map((c) => (
                <Link
                  key={c.organization_id}
                  to="/platform"
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition hover:border-gold-300 hover:bg-gold-50/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {c.display_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {c.admin_email} · {c.users_count} users
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gold-700">
                      {formatTZS(c.total_revenue_tsh)}
                    </p>
                    <Badge label={c.subscription_status ?? c.account_status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Accounts needing attention">
          {suspended.length === 0 ? (
            <div className="py-6 text-center">
              <UserCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                All accounts are in good standing.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suspended.slice(0, 6).map((c) => (
                <Link
                  key={c.organization_id}
                  to="/platform"
                  className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4 transition hover:border-amber-300"
                >
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {c.display_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {c.admin_email}
                    </p>
                  </div>
                  <Badge label={c.account_status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs text-gray-500">
        <Building2 className="h-4 w-4 text-gold-600" />
        Open the{" "}
        <Link
          to="/platform"
          className="font-semibold text-gold-700 hover:underline"
        >
          Platform control center
        </Link>{" "}
        to manage subscriptions, invoices and account status.
      </div>
    </div>
  );
}

// ── Account (tenant) dashboard ────────────────────────────────────────────────

function AccountDashboard() {
  // Fetch all events to find active ones
  const { data: eventsData } = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsApi.list(1, 50),
  });

  const events = eventsData?.data ?? [];
  const active = events.filter((e) => e.status === "active");
  const upcoming = events.filter(
    (e) => e.status === "approved" || e.status === "draft",
  );

  // Org-wide report summary for the SaaS tenant context
  const { data: reportSummary } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => reportsApi.summary(),
  });

  // Live stats for the first active event
  const activeEvent = active[0];
  const { data: scanStats, dataUpdatedAt } = useQuery({
    queryKey: ["scan-stats", activeEvent?.id],
    queryFn: () => scannerApi.stats(activeEvent!.id),
    enabled: !!activeEvent,
    refetchInterval: 10_000, // auto-refresh every 10s
  });

  const { data: eventSummary } = useQuery({
    queryKey: ["event-summary", activeEvent?.id],
    queryFn: () => eventsApi.summary(activeEvent!.id),
    enabled: !!activeEvent,
    refetchInterval: 10_000,
  });

  const summary = eventSummary?.summary;
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Org-wide snapshot (SaaS tenant context) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <MiniStat label="Events" value={reportSummary?.total_events ?? 0} />
        <MiniStat label="Guests" value={reportSummary?.total_guests ?? 0} />
        <MiniStat label="Arrivals" value={reportSummary?.total_arrivals ?? 0} />
        <MiniStat
          label="Payments"
          value={formatTZS(reportSummary?.total_payments_tsh ?? 0)}
        />
        <MiniStat
          label="Michango"
          value={formatTZS(reportSummary?.total_michango_tsh ?? 0)}
        />
        <MiniStat
          label="Broadcasts"
          value={reportSummary?.total_broadcasts ?? 0}
        />
      </div>

      {/* Active event banner */}
      {activeEvent ? (
        <div className="bg-navy-800 rounded-2xl p-6 text-white border border-gold-500/30 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs font-semibold uppercase tracking-wide">
                  Live Event
                </span>
              </div>
              <h2 className="text-2xl font-bold">{activeEvent.title}</h2>
              <p className="text-gray-400 text-sm mt-1">
                {activeEvent.venue_name} · {formatDate(activeEvent.event_date)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-black text-gold-400">
                {scanStats?.arrived ?? 0}
              </div>
              <p className="text-gray-400 text-sm">guests arrived</p>
              {lastUpdated && (
                <p className="text-gray-500 text-xs mt-1 flex items-center gap-1 justify-end">
                  <RefreshCw className="w-3 h-3" /> {lastUpdated}
                </p>
              )}
            </div>
          </div>

          {/* Arrival progress bar */}
          {scanStats && scanStats.total_guests > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{scanStats.arrival_rate_percent}% arrived</span>
                <span>
                  {scanStats.arrived} / {scanStats.total_guests}
                </span>
              </div>
              <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-400 rounded-full transition-all duration-700"
                  style={{ width: `${scanStats.arrival_rate_percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">
            No active events right now
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Activate an event to see live arrivals here.
          </p>
          <Link
            to="/events"
            className="inline-block mt-4 px-4 py-2 bg-gold-500 text-navy-900
                       rounded-lg text-sm font-semibold hover:bg-gold-600 transition-colors"
          >
            Go to Events
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Guests"
          value={summary?.total_guests ?? scanStats?.total_guests ?? 0}
          icon={Users}
          subtitle="Invited this event"
          color="blue"
        />
        <StatCard
          title="Checked In"
          value={scanStats?.arrived ?? 0}
          icon={UserCheck}
          subtitle={`${scanStats?.arrival_rate_percent ?? 0}% attendance`}
          color="green"
        />
        <StatCard
          title="RSVP Confirmed"
          value={summary?.rsvp_confirmed ?? 0}
          icon={CalendarDays}
          color="gold"
        />
        <StatCard
          title="Pending Arrival"
          value={scanStats?.pending ?? 0}
          icon={TrendingUp}
          subtitle="Not yet scanned"
          color="purple"
        />
      </div>

      {/* Arrival timeline chart */}
      {scanStats?.timeline && scanStats.timeline.length > 0 && (
        <Card title="Arrival Timeline">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scanStats.timeline} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                name="Arrivals"
                fill="#c9a84c"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <Card title="Upcoming Events">
          <div className="space-y-3">
            {upcoming.slice(0, 5).map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="flex items-center justify-between p-4 rounded-xl
                           border border-gray-100 hover:border-gold-300
                           hover:bg-gold-50/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg bg-navy-100 flex items-center
                                  justify-center text-navy-700 font-bold text-sm group-hover:bg-navy-200"
                  >
                    {new Date(event.event_date).getDate()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.venue_name} · {formatDate(event.event_date)}
                    </p>
                  </div>
                </div>
                <Badge label={event.status} />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}
