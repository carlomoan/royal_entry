// ==============================================================================
// FILE: src/pages/Platform.tsx
// ==============================================================================
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Users,
  CalendarDays,
  TrendingUp,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { platformApi } from "@/api/platform";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatTZS, formatDate } from "@/utils/format";
import type { PlatformCustomer } from "@/types";
import CreateOrganizationModal from "@/components/platform/CreateOrganizationModal";

export default function Platform() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: () => platformApi.summary(),
  });

  const { data: customersResponse, isLoading: customersLoading } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: () => platformApi.customers(),
  });

  const { data: plans } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformApi.plans(),
  });

  // ✅ FIX: Use the API response directly (already unwrapped in platform.ts)
  const list = customersResponse ?? [];

  const pendingApprovals = list.filter(
    (c: PlatformCustomer) => c.account_status === "pending_review"
  );

  const approveMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.approveAccount(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("Account approved");
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error ? error.message : "Failed to approve account";
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.rejectAccount(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("Account rejected");
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error ? error.message : "Failed to reject account";
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Platform control center
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage customer accounts, subscriptions and SaaS billing.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create organization
        </Button>
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

      {pendingApprovals.length > 0 && (
        <Card
          title="Pending approvals"
          action={
            <span className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              {pendingApprovals.length} awaiting review
            </span>
          }
        >
          <div className="space-y-3">
            {pendingApprovals.map((c: PlatformCustomer) => (
              <div
                key={c.organization_id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {c.display_name}
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {c.admin_email} · {c.current_plan_name ?? "No plan"} ·{" "}
                    {formatTZS(c.total_revenue_tsh)} paid
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(c.organization_id)}
                    disabled={approveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(c.organization_id)}
                    disabled={rejectMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      <Card title="Customer accounts">
        {customersLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No customers yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label="Platform customer accounts"
            >
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
                    "Actions",
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
                    <td className="px-4 py-3">
                      {c.account_status === "pending_review" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              approveMutation.mutate(c.organization_id)
                            }
                            disabled={approveMutation.isPending}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              rejectMutation.mutate(c.organization_id)
                            }
                            disabled={rejectMutation.isPending}
                            className="text-xs font-semibold text-rose-700 hover:text-rose-800"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateOrganizationModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
