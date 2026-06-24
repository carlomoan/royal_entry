// ==============================================================================
// FILE: src/components/layout/TopBar.tsx
// ==============================================================================

import { Bell, CalendarClock, SearchCheck } from "lucide-react";
import { useLocation } from "react-router-dom";

function resolvePageMeta(pathname: string) {
  if (pathname.startsWith("/events/") && pathname.endsWith("/scanner")) {
    return {
      title: "Guest scanner",
      subtitle: "Fast check-in for door attendants and reception staff",
    };
  }

  if (pathname.startsWith("/events/") && pathname.includes("/broadcast")) {
    return {
      title: "Broadcast center",
      subtitle: "Send reminders and track delivery results",
    };
  }

  if (pathname.startsWith("/events/") && pathname.includes("/michango")) {
    return {
      title: "Michango tracking",
      subtitle: "Monitor pledges, payments and reminder activity",
    };
  }

  if (pathname.startsWith("/events/")) {
    return {
      title: "Event workspace",
      subtitle: "Manage one event from invitations to gate entry",
    };
  }

  if (pathname.startsWith("/dashboard")) {
    return {
      title: "Dashboard",
      subtitle: "See what needs attention today at a glance",
    };
  }

  if (pathname.startsWith("/events")) {
    return {
      title: "Events",
      subtitle: "Create, organize and prepare memorable occasions",
    };
  }

  if (pathname.startsWith("/payments")) {
    return {
      title: "Payments",
      subtitle: "Follow collections, receipts and status updates",
    };
  }

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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-700">
          RoyalEntry workspace
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
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
        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-700">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
