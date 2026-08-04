// ==============================================================================
// FILE: src/components/layout/TopBar.tsx
// ==============================================================================
import { Bell, CalendarClock, SearchCheck } from "lucide-react";

import { useLocation } from "react-router-dom";

function resolvePageMeta(pathname: string) {
  // ── Event-scoped routes (most specific first) ─────────────────────────
  if (pathname.startsWith("/events/") && pathname.endsWith("/scanner"))
    return {
      title: "Guest scanner",
      subtitle: "Fast check-in for door attendants and reception staff",
    };
  if (pathname.startsWith("/events/") && pathname.endsWith("/cards"))
    return {
      title: "Invitation Card Studio",
      subtitle: "Design branded guest cards, QR access and reminder flow",
    };
  if (pathname.startsWith("/events/") && pathname.includes("/broadcast"))
    return {
      title: "Broadcast center",
      subtitle: "Send reminders and track delivery results",
    };
  if (pathname.startsWith("/events/") && pathname.includes("/michango"))
    return {
      title: "Michango tracking",
      subtitle: "Monitor pledges, payments and reminder activity",
    };
  if (pathname.startsWith("/events/"))
    return {
      title: "Event workspace",
      subtitle: "Manage one event from invitations to gate entry",
    };

  // ── Platform sub-routes (must come before /platform catch-all) ────────
  if (pathname === "/platform/accounts")
    return {
      title: "Customer accounts",
      subtitle: "Approve, suspend and manage tenants",
    };
  if (pathname === "/platform/packages")
    return {
      title: "Packages",
      subtitle: "Define plans and feature limits",
    };
  if (pathname === "/platform/templates")
    return {
      title: "Card templates",
      subtitle: "Global invitation design library",
    };
  if (pathname === "/platform/rbac")
    return {
      title: "RBAC",
      subtitle: "Role definitions and permissions matrix",
    };
  if (pathname === "/platform/audit")
    return {
      title: "Audit log",
      subtitle: "System-wide activity trail",
    };
  if (pathname === "/platform/payments")
    return {
      title: "Platform payments",
      subtitle: "All M-Pesa and card transactions",
    };
  if (pathname === "/platform/settings")
    return {
      title: "System settings",
      subtitle: "Global configuration",
    };
  if (pathname.startsWith("/platform"))
    return {
      title: "Platform control center",
      subtitle: "Manage customer accounts, payments and SaaS operations",
    };

  // ── Client routes ─────────────────────────────────────────────────────
  if (pathname.startsWith("/dashboard"))
    return {
      title: "Dashboard",
      subtitle: "See what needs attention today at a glance",
    };
  if (pathname.startsWith("/events"))
    return {
      title: "Events",
      subtitle: "Create, organize and prepare memorable occasions",
    };
  if (pathname.startsWith("/payments"))
    return {
      title: "Payments",
      subtitle: "Follow collections, receipts and status updates",
    };
  if (pathname.startsWith("/reports"))
    return {
      title: "Reports",
      subtitle: "Workspace summaries and downloadable CSV exports",
    };
  if (pathname.startsWith("/team"))
    return {
      title: "Team",
      subtitle: "Event-scoped roles and access",
    };
  if (pathname.startsWith("/audit"))
    return {
      title: "Audit log",
      subtitle: "Security trail of every authenticated action",
    };
  if (pathname.startsWith("/settings"))
    return {
      title: "Settings",
      subtitle: "Organization profile, team members and roles",
    };

  return {
    title: "RoyalEntry",
    subtitle: "Elegant guest operations made simple",
  };
}

export default function TopBar() {
  const { pathname } = useLocation();
  const { title, subtitle } = resolvePageMeta(pathname);

  return (
    <header className="flex flex-col gap-4 border-b border-white/70 bg-white/70 px-4 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-center gap-3">
        <img src="/RoyalEntrylogoVector2.svg" alt="RoyalEntry" className="h-8 w-8" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-700">
            RoyalEntry workspace
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-600 shadow-sm">
          <SearchCheck className="h-4 w-4 text-gold-600" />
          <span>Keep guest names and phone numbers accurate</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
          <CalendarClock className="h-4 w-4 text-sky-600" />
          {new Date().toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
        <button
          aria-label="Notifications"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-700"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}