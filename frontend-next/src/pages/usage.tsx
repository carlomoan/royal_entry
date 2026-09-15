"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Gauge, CalendarDays, Users, UserCheck, CreditCard, AlertTriangle,
  Check, X, TrendingUp, Sparkles, ScanLine, Banknote, Infinity as InfinityIcon,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { Card, Badge, Button } from "@/components/ui";
import { formatDate, formatTZS, cn } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  events: "Events", guests: "Guests", invitations: "Invitations", scanner: "Scanner",
  michango: "Michango", broadcast: "Broadcast", payments: "Payments", reports: "Reports",
  audit: "Audit Log", team: "Team Management", settings: "Settings", cards: "Card Studio",
  webhooks: "Webhooks", api: "API Access",
};

function LimitBar({ icon: Icon, label, used, max }: { icon: any; label: string; used: number; max: number | null }) {
  const unlimited = max == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / (max as number)) * 100));
  const barColor = unlimited
    ? "bg-emerald-500"
    : pct >= 100 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-950">
            <Icon className="h-4 w-4 text-gold-400" />
          </div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
        </div>
        <p className="text-sm font-bold text-slate-900">
          {used} / {unlimited ? <InfinityIcon className="inline h-4 w-4 text-emerald-600" /> : max}
        </p>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: unlimited ? "4%" : `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {unlimited ? "Unlimited on your plan" : `${pct}% used · ${Math.max((max as number) - used, 0)} remaining`}
      </p>
      {!unlimited && pct >= 100 && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-rose-600">
          <AlertTriangle className="h-3 w-3" /> Limit reached — contact your provider to upgrade.
        </p>
      )}
    </div>
  );
}

export default function UsagePage() {
  /* Exact DB data: subscription row (with plan limits + features) */
  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: async () => (await api.get("/billing/subscription")).data.data,
  });

  /* Exact DB data: live usage counts */
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["billing-usage"],
    queryFn: async () => (await api.get("/billing/usage")).data.data,
  });

  const loading = subLoading || usageLoading;
  const u = usage ?? { events: 0, guests: 0, users: 0, scans: 0, payments: 0 };
  const features: Record<string, boolean> = sub?.features ?? {};

  const anyOver =
    sub &&
    ((sub.max_events != null && u.events >= sub.max_events) ||
      (sub.max_guests != null && u.guests >= sub.max_guests) ||
      (sub.max_users != null && u.users >= sub.max_users));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usage & Plan Limits</h1>
          <p className="text-sm text-slate-500">Live consumption measured against your assigned package</p>
        </div>
        {sub && <Badge label={sub.status} variant={sub.status === "active" ? "green" : sub.status === "trialing" ? "blue" : "rose"} />}
      </div>

      {anyOver && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
          <div className="flex-1 text-sm text-rose-800">
            <p className="font-semibold">You've reached a plan limit</p>
            <p className="mt-0.5 text-xs">New events, guests or users may be blocked until you upgrade.</p>
          </div>
          <Link href="/billing">
            <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100">View billing</Button>
          </Link>
        </div>
      )}

      {/* Plan summary — straight from subscription + plan rows */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : sub ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><CreditCard className="h-3.5 w-3.5" /> Package</div>
            <p className="mt-2 text-lg font-bold text-slate-900">{sub.plan_name}</p>
            <p className="text-xs text-slate-500">{formatTZS(sub.price_tsh)} / {sub.billing_interval}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><TrendingUp className="h-3.5 w-3.5" /> Status</div>
            <p className="mt-2 text-lg font-bold capitalize text-slate-900">{sub.status}</p>
            <p className="text-xs text-slate-500">{sub.trial_ends_at ? `Trial ends ${formatDate(sub.trial_ends_at)}` : "Active subscription"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> Period ends</div>
            <p className="mt-2 text-lg font-bold text-slate-900">{formatDate(sub.current_period_end)}</p>
            <p className="text-xs text-slate-500">Renewal due on this date</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><Sparkles className="h-3.5 w-3.5" /> Limits</div>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {[
                sub.max_events != null ? `${sub.max_events} events` : null,
                sub.max_guests != null ? `${sub.max_guests} guests` : null,
                sub.max_users != null ? `${sub.max_users} users` : null,
              ].filter(Boolean).join(" · ") || "Unlimited"}
            </p>
            <p className="text-xs text-slate-500">defined by your package</p>
          </div>
        </div>
      ) : (
        <Card>
          <div className="py-10 text-center">
            <Gauge className="mx-auto mb-3 h-12 w-12 text-slate-200" />
            <h3 className="font-semibold text-slate-700">No active subscription</h3>
            <p className="mt-1 text-sm text-slate-500">Contact the platform admin to activate your package.</p>
          </div>
        </Card>
      )}

      {/* Usage vs limits — live counts from /billing/usage */}
      {sub && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-5">
          <LimitBar icon={CalendarDays} label="Events" used={u.events} max={sub.max_events ?? null} />
          <LimitBar icon={Users} label="Guests" used={u.guests} max={sub.max_guests ?? null} />
          <LimitBar icon={UserCheck} label="Team Users" used={u.users} max={sub.max_users ?? null} />
          <LimitBar icon={ScanLine} label="Scans" used={u.scans ?? 0} max={null} />
          <LimitBar icon={Banknote} label="Payments" used={u.payments ?? 0} max={null} />
        </div>
      )}

      {/* Feature access — from plan.features JSON in the DB */}
      {sub && (
        <Card title="Feature Access">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => {
              const enabled = features[key] !== false;
              return (
                <div key={key} className={cn(
                  "flex items-center gap-2 rounded-lg border p-3 text-sm font-medium",
                  enabled ? "border-emerald-100 bg-emerald-50/60 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-400"
                )}>
                  {enabled ? <Check className="h-4 w-4 flex-shrink-0" /> : <X className="h-4 w-4 flex-shrink-0" />}
                  {label}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Feature access is enforced by the backend on every request. Upgrades unlock features instantly.
          </p>
        </Card>
      )}
    </div>
  );
}
