"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Mail, Phone, ShieldCheck, Building2, CalendarDays,
  Settings, LogOut, BadgeCheck, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, Badge, Button } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { isPlatformAdmin, roleLabel } from "@/lib/roles";

export default function ProfilePage() {
  const { user: authUser, logout } = useAuth();

  const { data: me, isLoading } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => (await api.get("/auth/me")).data.data ?? (await api.get("/auth/me")).data,
    retry: 1,
  });

  const user = me ?? authUser;
  if (!user) return null;

  const platform = isPlatformAdmin(user.role);
  const unassigned = !platform && !user.organization_id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500">View your personal information and account details</p>
        </div>
      </div>

      {/* Unassigned notice */}
      {unassigned && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Account not assigned yet</p>
            <p className="mt-0.5 text-xs">
              You are not yet assigned to an organization account. You can only view your profile until a
              super administrator assigns you to an account with a role. Contact your administrator.
            </p>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-fadeIn">
        {/* Banner */}
        <div className="relative h-28 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: "radial-gradient(#c9a84c 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="absolute -bottom-10 left-6 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-gold-400 to-gold-600 text-2xl font-black text-navy-950 shadow-lg">
            {user.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!platform && (
            <div className="absolute bottom-3 right-5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              {roleLabel(user.role)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-6 pb-6 pt-14">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{user.full_name}</h2>
              <p className="text-sm text-slate-500">{user.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge label={platform ? "Platform Admin" : "Account Staff"} variant={platform ? "gold" : "blue"} />
                <Badge label={user.is_active ? "active" : "inactive"} variant={user.is_active ? "green" : "rose"} />
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/settings">
                <Button variant="ghost" size="sm"><Settings className="h-4 w-4" /> Settings</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} className="text-rose-600"><LogOut className="h-4 w-4" /> Sign out</Button>
            </div>
          </div>

          {/* Details grid */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow icon={Mail} label="Email Address" value={user.email} />
            <InfoRow icon={Phone} label="Phone Number" value={(user as any).phone ?? "Not set"} />
            <InfoRow icon={ShieldCheck} label="Role" value={roleLabel(user.role)} />
            <InfoRow icon={BadgeCheck} label="Status" value={user.is_active ? "Active" : "Inactive"} />
            <InfoRow icon={CalendarDays} label="Joined" value={formatDate(user.created_at)} />
            {(user as any).organization_name && (
              <InfoRow icon={Building2} label="Organization" value={(user as any).organization_name} />
            )}
          </div>
        </div>
      </div>

      {/* Security section */}
      <Card title="Security">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Password</p>
              <p className="text-xs text-slate-400">Change your password regularly for security</p>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="ghost" size="sm">Change password</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}