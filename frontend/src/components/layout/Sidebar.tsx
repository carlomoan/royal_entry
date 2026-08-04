// ==============================================================================
// FILE: src/components/layout/Sidebar.tsx
// ==============================================================================
import {
  NavLink
} from "react-router-dom";
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
  Building2,
  Palette,
  Users,
  Webhook,
  Variable,
} from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { cn } from "@/utils/cn";
import { isPlatformAdmin, can, roleLabel } from "@/utils/roles";

type NavItem = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  permission?: string;
};

// ── Account / client workspace navigation ──────────────────────────────────
// Visible to account-scoped users only (account_admin, event_manager, etc.)
const ACCOUNT_NAV: NavItem[] = [
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
    permission: "events:read",
  },
  {
    to: "/payments",
    icon: CreditCard,
    label: "Payments",
    description: "Track collections and transactions",
    permission: "payments:read",
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reports",
    description: "Summaries and CSV exports across events",
    permission: "reports:read",
  },
  {
    to: "/audit",
    icon: ScrollText,
    label: "Audit log",
    description: "Track every action across the workspace",
    permission: "audit:read",
  },
  {
    to: "/settings",
    icon: ShieldCheck,
    label: "Settings",
    description: "Organization profile, team and roles",
  },
];

// ── Platform (SaaS) navigation ──────────────────────────────────────────────
// Visible to platform roles only (superadmin, platform_admin, system_admin)
const PLATFORM_NAV: NavItem[] = [
  {
    to: "/platform",
    icon: LayoutDashboard,
    label: "Overview",
    description: "SaaS metrics and approvals",
  },
  {
    to: "/platform/accounts",
    icon: Building2,
    label: "Accounts",
    description: "Approve & manage tenants",
  },
  {
    to: "/platform/packages",
    icon: Palette,
    label: "Packages",
    description: "Plans & feature limits",
  },
  {
    to: "/platform/users",
    icon: Users,
    label: "Users",
    description: "Manage users across all organizations",
  },
  {
    to: "/platform/webhooks",
    icon: Webhook,
    label: "Webhooks",
    description: "Configure HTTP callbacks for events",
  },
  {
    to: "/platform/payments",
    icon: CreditCard,
    label: "Payments",
    description: "All M-Pesa and card transactions",
  },
  {
    to: "/platform/audit",
    icon: ScrollText,
    label: "Audit log",
    description: "System-wide activity trail",
  },
  {
    to: "/platform/settings",
    icon: Settings2,
    label: "System settings",
    description: "Global configuration",
  },
  {
    to: "/platform/global-variables",
    icon: Variable,
    label: "Global variables",
    description: "Reusable config values",
  },
  {
    to: "/platform/card-templates",
    icon: Palette,
    label: "Card templates",
    description: "Global invitation design library",
  },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const platform = isPlatformAdmin(user?.role);

  const navItems: NavItem[] = platform
    ? PLATFORM_NAV
    : ACCOUNT_NAV.filter(
        (item) => !item.permission || can(user?.role, item.permission),
      );

  return (
    <aside className="flex w-72 flex-col rounded-[30px] border border-white/10 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 p-4 text-white shadow-2xl shadow-navy-900/30">
      <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30">
            <Crown className="h-6 w-6 text-navy-950" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">RoyalEntry</h1>
            <p className="text-xs text-slate-300">
              {platform ? "Platform console" : "Client workspace"}
            </p>
          </div>
        </div>
        {!platform && user?.role && (
          <div className="mt-4 rounded-2xl bg-white/5 p-4">
            <div className="flex items-center gap-2 text-gold-300">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                {roleLabel(user.role)}
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {user.full_name ?? "Team member"}
            </p>
          </div>
        )}
      </div>

      <nav className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
        {navItems.map(({ to, icon: Icon, label, description }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <div
                className={cn(
                  "group flex items-start gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-gradient-to-r from-gold-400 to-gold-500 text-navy-950 shadow-lg shadow-gold-500/30"
                    : "text-slate-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl transition",
                    isActive
                      ? "bg-white/35"
                      : "bg-white/10 group-hover:bg-white/15",
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
              </div>
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
              {user?.role ? roleLabel(user.role) : "team member"}
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