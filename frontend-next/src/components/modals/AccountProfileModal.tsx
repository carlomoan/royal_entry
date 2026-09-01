"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2, Mail, Users, CalendarDays as EventsIcon, CreditCard,
  Activity, X, ArrowRight, ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { Badge } from "@/components/ui";
import { formatDate, formatTZS } from "@/lib/utils";
import { isPlatformAdmin } from "@/lib/roles";
import { useAuth } from "@/lib/auth";

interface AccountProfileModalProps {
  orgId: string;
  onClose: () => void;
}

export function AccountProfileModal({ orgId, onClose }: AccountProfileModalProps) {
  const { user } = useAuth();
  const canView = isPlatformAdmin(user?.role);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["account-profile-modal", orgId],
    queryFn: async () => (await api.get(`/platform/customers/${orgId}`)).data.data,
    enabled: !!orgId && canView,
    retry: 1,
  });

  if (!canView) {
    return (
      <Overlay onClose={onClose}>
        <div className="p-8 text-center">
          <p className="font-semibold text-slate-700">Access Denied</p>
          <p className="text-xs text-slate-500">You don't have permission to view this account.</p>
          <button onClick={onClose} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Close</button>
        </div>
      </Overlay>
    );
  }

  if (isLoading) {
    return (
      <Overlay onClose={onClose}>
        <p className="p-8 text-sm text-slate-500">Loading profile…</p>
      </Overlay>
    );
  }

  if (!detail) {
    return (
      <Overlay onClose={onClose}>
        <p className="p-8 text-center text-sm text-slate-400">Account not found</p>
      </Overlay>
    );
  }

  const c = detail.customer;

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div className="relative bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 p-6">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-white/70 transition hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600">
            <Building2 className="h-6 w-6 text-navy-950" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{c.display_name}</h2>
            <p className="text-sm text-slate-400">{c.admin_email}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Badge label={c.account_status} className="bg-white/15 text-white" />
          {c.current_plan_name && <Badge label={c.current_plan_name} variant="gold" />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 border-b border-slate-100 p-5">
        <ModalStat icon={Users} label="Users" value={c.users_count} />
        <ModalStat icon={EventsIcon} label="Events" value={`${c.active_events_count}/${c.events_count}`} />
        <ModalStat icon={CreditCard} label="Revenue" value={formatTZS(c.total_revenue_tsh)} />
      </div>

      {/* Details */}
      <div className="space-y-2.5 p-5">
        <DetailRow icon={Mail} label="Admin Email" value={c.admin_email} />
        <DetailRow icon={ShieldCheck} label="Status" value={c.account_status} />
        <DetailRow icon={Activity} label="Last Activity" value={formatDate(c.last_activity_at)} />
        <DetailRow icon={CreditCard} label="Plan" value={c.current_plan_name ?? "No plan"} />
        {c.subscription_status && <DetailRow icon={Activity} label="Subscription" value={c.subscription_status} />}
      </div>

      {/* Team preview */}
      {detail.users?.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Team Members ({detail.users.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {(detail.users as any[]).slice(0, 5).map((u: any) => (
              <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-950 text-[9px] font-bold text-gold-400">
                  {u.full_name?.[0]?.toUpperCase() ?? "U"}
                </span>
                {u.full_name?.split(" ")[0]}
              </span>
            ))}
            {detail.users.length > 5 && <span className="text-xs text-slate-400">+{detail.users.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
        <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>
        <Link
          href={`/platform/accounts/${orgId}`}
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-600"
        >
          Full Profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl animate-scaleIn">{children}</div>
    </div>
  );
}

function ModalStat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-gold-600" />
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /> {label}</span>
      <span className="font-semibold capitalize text-slate-900">{value}</span>
    </div>
  );
}