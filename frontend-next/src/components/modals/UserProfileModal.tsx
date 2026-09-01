"use client";

import {
  Mail, Phone, ShieldCheck, CalendarDays, X, ArrowRight, Building2,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";

interface UserProfileModalProps {
  user: any;
  onClose: () => void;
}

// Lightweight user profile modal showing only non-sensitive public info
export function UserProfileModal({ user, onClose }: UserProfileModalProps) {
  const platform = ["superadmin", "platform_admin", "system_admin"].includes(user?.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl animate-scaleIn">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 p-6 text-center">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-white/70 transition hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white/20 bg-gradient-to-br from-gold-400 to-gold-600 text-2xl font-black text-navy-950">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <h2 className="mt-3 text-lg font-bold text-white">{user?.full_name}</h2>
          <p className="text-sm text-slate-400">{user?.email}</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge label={platform ? "Global Admin" : "Staff"} variant={platform ? "gold" : "blue"} />
            <Badge label={roleLabel(user?.role)} variant="slate" />
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2.5 p-5">
          <DetailRow icon={Mail} label="Email" value={user?.email} />
          <DetailRow icon={Phone} label="Phone" value={user?.phone ?? "—"} />
          <DetailRow icon={ShieldCheck} label="Role" value={roleLabel(user?.role)} />
          <DetailRow icon={Building2} label="Organization" value={platform ? "Global" : (user?.organization_name ?? "Unassigned")} />
          <DetailRow icon={CalendarDays} label="Joined" value={formatDate(user?.created_at)} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>
          <Link
            href="/profile"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-600"
          >
            My Profile <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /> {label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}