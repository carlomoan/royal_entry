"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Mail, CalendarDays, Users, CalendarDays as EventsIcon,
  CreditCard, ArrowLeft, ShieldCheck, Activity, ShieldX,
  AlertTriangle, UserPlus, Crown,
} from "lucide-react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, Badge, StatCard, Button, Modal, Select } from "@/components/ui";
import { formatDate, formatTZS } from "@/lib/utils";
import { isPlatformAdmin } from "@/lib/roles";
import { SubscriptionManager } from "@/components/platform/SubscriptionManager";

export default function AccountProfilePage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { user: authUser } = useAuth();
  const qc = useQueryClient();
  const canView = isPlatformAdmin(authUser?.role);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");

  const { data: detail, isLoading, isError, refetch: refetchDetail } = useQuery({
    queryKey: ["account-profile", id],
    queryFn: async () => (await api.get(`/platform/customers/${id}`)).data.data,
    enabled: !!id && canView,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["platform-users-for-assign"],
    queryFn: async () => (await api.get("/platform/users")).data.data,
    enabled: assignOpen,
  });
  const { data: usageReport } = useQuery({
    queryKey: ["organization-usage", id],
    queryFn: async () => (await api.get(`/platform/organizations/${id}/usage`)).data.data,
    enabled: !!id && canView,
  });
  const { data: usageLimits } = useQuery({
    queryKey: ["organization-usage-limits", id],
    queryFn: async () => (await api.get(`/platform/organizations/${id}/usage/limits`)).data.data,
    enabled: !!id && canView,
  });

  const promoteMutation = useMutation({
    mutationFn: (userId: string) => api.put(`/platform/users/${userId}`, { role: "account_admin" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["account-profile", id] });
      await refetchDetail();
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("User promoted to Account Admin");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to promote user"),
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) =>
      api.put(`/platform/users/${userId}`, { organization_id: id, role: "account_admin" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["account-profile", id] });
      await refetchDetail();
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      qc.invalidateQueries({ queryKey: ["platform-users"] });
      setAssignOpen(false);
      setAssignUserId("");
      toast.success("Account admin assigned");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to assign admin"),
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

  if (isLoading) return <div className="space-y-4"><div className="h-24 animate-pulse rounded-lg bg-slate-100" /><div className="h-64 animate-pulse rounded-lg bg-slate-100" /></div>;
  if (isError || !detail) return <Card><div className="space-y-3 py-8 text-center"><p className="text-sm text-rose-700">Organization profile could not be loaded.</p><Button variant="outline" size="sm" onClick={() => refetchDetail()}>Retry</Button></div></Card>;

  const c = detail.customer;
  // ✅ Safely map all members related to this specific organization
  const teamMembers = detail.users ?? [];
  const hasAdmin = teamMembers.some((u: any) => u.role === "account_admin");

  // ✅ STRICT FILTER: Only show users who are completely unassigned (no organization_id)
  const assignableUsers = allUsers.filter(
    (u: any) => !["superadmin", "platform_admin", "system_admin"].includes(u.role) && !u.organization_id
  );

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

      {!hasAdmin && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800">
            <p className="font-semibold">No account admin</p>
            <p className="mt-0.5 text-xs">
              This organization was created without an admin. Promote a team member below, or assign an unassigned user.
            </p>
          </div>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Assign admin
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard title="Users" value={c.users_count} icon={Users} color="blue" />
        <StatCard title="Events" value={`${c.active_events_count}/${c.events_count}`} icon={EventsIcon} color="green" />
        <StatCard title="Revenue" value={formatTZS(c.total_revenue_tsh)} icon={CreditCard} color="gold" />
        <StatCard title="Payments" value={`${c.completed_payments_count}/${c.total_payments_count}`} icon={Activity} color="purple" />
      </div>

      <Card title="30-day Usage" action={<Link href="/platform/users" className="text-xs font-semibold text-gold-700 hover:underline">Manage platform users</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Events created", usageReport?.events_count],
            ["Guests added", usageReport?.guests_count],
            ["Invitations sent", usageReport?.invitations_sent],
            ["Card/scanner visits", usageReport?.scans_count],
            ["Payments", usageReport?.payments_count],
            ["Broadcasts", usageReport?.broadcasts_sent],
            ["Storage", `${usageReport?.storage_mb ?? 0} MB`],
            ["API calls", usageReport?.api_calls],
          ].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value ?? "—"}</p></div>)}
        </div>
        {usageLimits?.metrics?.length > 0 && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">{usageLimits.metrics.map((metric: any) => <div key={metric.metric_name}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{metric.metric_name}</span><span className="font-semibold text-slate-700">{metric.value}{metric.limit != null ? ` / ${metric.limit}` : ""}</span></div><div className="h-1.5 overflow-hidden rounded bg-slate-100"><div className={`h-full ${metric.percentage >= 90 ? "bg-rose-500" : metric.percentage >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(metric.percentage ?? 0, 100)}%` }} /></div></div>)}</div>}
      </Card>

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

        {/* ── Assigned Team Members Section ───────────────────────────────────── */}
        <Card
          title={`Team Members (${teamMembers.length})`}
          action={
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Assign admin
            </Button>
          }
        >
          {!teamMembers.length ? (
            <div className="py-8 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-slate-200" />
              <p className="text-sm text-slate-400">No team members assigned to this organization yet</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-2">
              {teamMembers.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-950 text-xs font-bold text-gold-400">
                    {u.full_name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.full_name}</p>
                    <p className="truncate text-xs text-slate-500">{u.email} · {u.role}</p>
                  </div>
                  {u.role !== "account_admin" && (
                    <button
                      onClick={() => {
                        if (confirm(`Promote ${u.full_name} to Account Admin?`))
                          promoteMutation.mutate(u.id);
                      }}
                      title="Promote to Account Admin"
                      className="rounded p-1.5 text-gold-700 hover:bg-gold-50"
                    >
                      <Crown className="h-4 w-4" />
                    </button>
                  )}
                  <Badge label={u.is_active ? "active" : "inactive"} variant={u.is_active ? "green" : "rose"} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Subscription & Billing Manager */}
      <SubscriptionManager orgId={id} />

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

      {/* ── Assign admin modal ──────────────────────────────────────────────── */}
      <Modal isOpen={assignOpen} onClose={() => { setAssignOpen(false); setAssignUserId(""); }} title={`Assign Account Admin — ${c.display_name}`} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Select an <strong>unassigned</strong> user to move into this organization as <strong>account_admin</strong>.
          </p>
          <Select label="User" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
            <option value="">— Choose an unassigned user —</option>
            {assignableUsers.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.full_name} · {u.email}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setAssignOpen(false); setAssignUserId(""); }}>Cancel</Button>
            <Button
              onClick={() => assignUserId && assignMutation.mutate(assignUserId)}
              isLoading={assignMutation.isPending}
              disabled={!assignUserId}
            >
              <UserPlus className="h-4 w-4" /> Assign as admin
            </Button>
          </div>
        </div>
      </Modal>
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
