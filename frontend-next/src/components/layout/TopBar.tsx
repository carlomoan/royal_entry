"use client";

import { Bell, Search } from "lucide-react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import { roleLabel } from "@/lib/roles";

function getBreadcrumb(pathname: string): string {
  const map: Record<string, string> = {
    "/platform": "Platform / Overview",
    "/platform/accounts": "Platform / Accounts",
    "/platform/users": "Platform / Users",
    "/platform/packages": "Platform / Packages",
    "/platform/card-templates": "Platform / Card Templates",
    "/platform/global-variables": "Platform / Global Variables",
    "/platform/webhooks": "Platform / Webhooks",
    "/platform/payments": "Platform / Payments",
    "/platform/audit": "Platform / Audit Log",
    "/platform/settings": "Platform / Settings",
    "/dashboard": "Dashboard",
    "/events": "Events",
    "/payments": "Payments",
    "/reports": "Reports",
    "/audit": "Audit Log",
    "/settings": "Settings",
  };
  return map[pathname] ?? "Dashboard";
}

export default function TopBar() {
  const router = useRouter();
  const pathname = router.pathname;
  const { user } = useAuth();
  const breadcrumb = getBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium text-slate-500">{breadcrumb}</p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-gold-400 focus:bg-white focus:ring-2 focus:ring-gold-100"
          />
        </div>

        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
          </span>
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-800">{user?.full_name}</p>
            <p className="text-[10px] text-slate-400">{roleLabel(user?.role)}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-navy-800 to-navy-950 text-sm font-bold text-gold-400 ring-2 ring-gold-100">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
        </div>
      </div>
    </header>
  );
}