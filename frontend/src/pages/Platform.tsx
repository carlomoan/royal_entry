// ==============================================================================
// FILE: src/pages/Platform.tsx
// ==============================================================================
// Platform control center — SaaS operations, customers, plans and billing.

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  CalendarDays,
  TrendingUp,
  CreditCard,
  Loader2,
} from "lucide-react";
import { platformApi } from "@/api/platform";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatTZS, formatDate } from "@/utils/format";
import type { PlatformCustomer } from "@/types";

export default function Platform() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: () => platformApi.summary(),
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: () => platformApi.customers(),
  });

  const { data: plans } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformApi.plans(),
  });

  const list = customers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Platform control center
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage customer accounts, subscriptions and SaaS billing.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Customers"
          value={summary?.total_customers ?? 0}
          subtitle={`${summary?.active_customers ?? 0} active`}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Total Users"
          value={summary?.total_users ?? 0}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Active Events"
          value={summary?.active_events ?? 0}
          icon={CalendarDays}
          color="green"
        />
        <StatCard
          title="MRR"
          value={formatTZS(summary?.monthly_recurring_revenue_tsh ?? 0)}
          subtitle="Monthly recurring revenue"
          icon={TrendingUp}
          color="gold"
        />
      </div>

      {summaryLoading && (
        <p className="text-sm text-gray-400">Loading summary…</p>
      )}

      {/* Plans */}
      {plans && plans.length > 0 && (
        <Card title="Service plans">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                  <Badge label={plan.billing_interval} />
                </div>
                <p className="text-2xl font-black text-gold-600">
                  {formatTZS(plan.price_tsh)}
                </p>
                <p className="text-xs text-gray-500">
                  {plan.description ?? "—"}
                </p>
                <div className="mt-1 flex gap-3 text-xs text-gray-500">
                  <span>
                    {plan.max_users == null ? "Unlimited" : `${plan.max_users}`}{" "}
                    users
                  </span>
                  <span>
                    {plan.max_events == null
                      ? "Unlimited"
                      : `${plan.max_events}`}{" "}
                    events
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Customers */}
      <Card title="Customer accounts">
        {customersLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No customers yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Organization",
                    "Admin",
                    "Status",
                    "Users",
                    "Events",
                    "Revenue",
                    "Plan",
                    "Last activity",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((c: PlatformCustomer) => (
                  <tr key={c.organization_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.display_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.admin_email}</td>
                    <td className="px-4 py-3">
                      <Badge label={c.account_status} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.users_count}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.active_events_count}/{c.events_count}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {formatTZS(c.total_revenue_tsh)}
                    </td>
                    <td className="px-4 py-3">
                      {c.current_plan_name ? (
                        <span className="text-xs font-semibold text-gold-700">
                          {c.current_plan_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.last_activity_at
                        ? formatDate(c.last_activity_at)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs text-gray-500">
        <CreditCard className="h-4 w-4 text-gold-600" />
        Use the customer detail endpoints to manage subscriptions, invoices and
        account status.
      </div>
    </div>
  );
}
