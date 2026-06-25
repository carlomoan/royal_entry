// ==============================================================================
// FILE: src/components/layout/Sidebar.tsx
// ==============================================================================

import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  Crown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings2,
  Sparkles,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { cn } from "@/utils/cn";
import { isPlatformAdmin, isAccountAdmin } from "@/utils/roles";

const baseNavItems = [
  {
    to: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    description: "Live arrivals and quick overview",
  },
  {
    to: "/events",
    icon: CalendarDays,
    label: "Events",
    description: "Guests, scanner, invitations and campaigns",
  },
  {
    to: "/payments",
    icon: CreditCard,
    label: "Payments",
    description: "Track collections and transactions",
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reports",
    description: "Summaries and CSV exports across events",
  },
];

export default function Sidebar() {
  const { logout, user } = useAuth();

  const navItems = [
    ...baseNavItems,
    ...(isAccountAdmin(user?.role)
      ? [
          {
            to: "/audit",
            icon: ScrollText,
            label: "Audit log",
            description: "Track every action across the workspace",
          },
        ]
      : []),
    ...(isPlatformAdmin(user?.role)
      ? [
          {
            to: "/platform",
            icon: Settings2,
            label: "Platform",
            description: "Manage customer accounts and SaaS operations",
          },
        ]
      : []),
    {
      to: "/settings",
      icon: ShieldCheck,
      label: "Settings",
      description: "Organization profile, team and roles",
    },
  ];

  return (
    <aside className="flex w-72 flex-col rounded-[30px] border border-white/10 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 p-4 text-white shadow-2xl shadow-navy-900/30">
      <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30">
            <Crown className="h-6 w-6 text-navy-950" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">RoyalEntry</h1>
            <p className="text-xs text-slate-300">Elegant guest management</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/5 p-4">
          <div className="flex items-center gap-2 text-gold-300">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">
              Simple workflow
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            Create an event, add guests, generate invitations, then use the
            scanner page at the door.
          </p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
        {navItems.map(({ to, icon: Icon, label, description }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "group flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 shadow-lg shadow-gold-500/30"
                  : "text-slate-200 hover:bg-white/8 hover:text-white",
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl transition",
                    isActive
                      ? "bg-white/35"
                      : "bg-white/8 group-hover:bg-white/12",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold">{label}</p>
                  <p
                    className={cn(
                      "mt-1 whitespace-normal break-words pr-2 text-xs leading-5",
                      isActive ? "text-navy-900/75" : "text-slate-400",
                    )}
                  >
                    {description}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition",
                    isActive
                      ? "translate-x-0.5 text-navy-900/70"
                      : "text-slate-500 group-hover:text-slate-300",
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-5 rounded-[26px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gold-400 font-bold text-navy-950 shadow-lg shadow-gold-500/20">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {user?.full_name ?? "RoyalEntry user"}
            </p>
            <p className="truncate text-xs capitalize text-slate-400">
              {user?.role ?? "team member"}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
