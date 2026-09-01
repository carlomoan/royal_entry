"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2, Mail, CalendarDays, Users, CalendarDays as EventsIcon,
  CreditCard, ArrowLeft, ShieldCheck, Activity, ShieldX,
} from "lucide-react";
import { useRouter } from "next/router";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, Badge, StatCard } from "@/components/ui";
import { formatDate, formatTZS } from "@/lib/utils";
import { isPlatformAdmin } from "@/lib/roles";

export default function AccountProfilePage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { user: authUser } = useAuth();
  const canView = isPlatformAdmin(authUser?.role);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["account-profile", id],
    queryFn: async () => (await api.get(`/platform/customers/${id}`)).data.data,
    enabled: !!id && canView,
  });

  if (!canView) {
    return (
      <div className="py-20 text-center">
        <ShieldX className="mx-auto mb-3 h-12 w-12 text-rose-300" />
        <p className="font-semibold text-slate-700">Access Denied</p>
        <p className="text-sm text-slate-500">You don't have permission to view this account profile.</p>
      </div>
    );
  }

  if (isLoading || !detail) return <p className="text-sm text-slate-500">Loading…</p>;

  const c = detail.customer;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{c.display_name}</h1>
          <p className="text-sm text-slate-500">Account Profile</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard title="Users" value={c.users_count} icon={Users} color="blue" />
        <StatCard title="Events" value={`${c.active_events_count}/${c.events_count}`} icon={EventsIcon} color="green" />
        <StatCard title="Revenue" value={formatTZS(c.total_revenue_tsh)} icon={CreditCard} color="gold" />
        <StatCard title="Payments" value={`${c.completed_payments_count}/${c.total_payments_count}`} icon={Activity} color="purple" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Organization Details">
          <div className="space-y-3">
            <Row icon={Building2} label="Display Name" value={c.display_name} />
            <Row icon={Mail} label="Admin Email" value={c.admin_email} />
            <Row icon={ShieldCheck} label="Status" value={<Badge label={c.account_status} />} />
            <Row icon={CalendarDays} label="Last Activity" value={formatDate(c.last_activity_at)} />
            <Row icon={CreditCard} label="Current Plan" value={c.current_plan_name ?? "No plan"} />
            {c.subscription_status && (
              <Row icon={Activity} label="Subscription" value={<Badge label={c.subscription_status} variant="blue" />} />
            )}
          </div>
        </Card>

        <Card title={`Team Members (${detail.users?.length ?? 0})`}>
          {!detail.users?.length ? (
            <p className="py-8 text-center text-sm text-slate-400">No team members</p>
          ) : (
            <div className="space-y-2.5">
              {detail.users.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-950 text-xs font-bold text-gold-400">
                    {u.full_name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.full_name}</p>
                    <p className="truncate text-xs text-slate-500">{u.email} · {u.role}</p>
                  </div>
                  <Badge label={u.is_active ? "active" : "inactive"} variant={u.is_active ? "green" : "rose"} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {detail.recent_payments?.length > 0 && (
        <Card title="Recent Payments">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Type", "Amount", "Method", "Status", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {detail.recent_payments.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-slate-700">{p.package_name ?? p.payment_type}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatTZS(p.amount_tsh)}</td>
                    <td className="px-4 py-3 text-slate-500">{p.payment_method}</td>
                    <td className="px-4 py-3"><Badge label={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detail.recent_invoices?.length > 0 && (
        <Card title="Recent Invoices">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Invoice #", "Plan", "Amount", "Status", "Due"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {detail.recent_invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.plan_name ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatTZS(inv.amount_tsh)}</td>
                    <td className="px-4 py-3"><Badge label={inv.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.due_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}