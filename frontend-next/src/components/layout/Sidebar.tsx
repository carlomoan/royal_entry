"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard, CalendarDays, CreditCard, BarChart3, ScrollText,
  Settings, Building2, Package, Users, Webhook, Palette, SlidersHorizontal,
  ChevronLeft, ChevronRight, LogOut, Crown, ShieldCheck, UserCircle,
  ScanLine, Sparkles, MessageCircle, MessageSquare, Send, Gauge, FileText, QrCode, // ✅ Added QrCode
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isPlatformAdmin, roleLabel, can } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission?: string;
}
interface NavSection { title: string; items: NavItem[]; }

const PLATFORM_NAV: NavSection[] = [
  { title: "Dashboard", items: [{ href: "/platform", icon: LayoutDashboard, label: "Overview" }] },
  {
    title: "Management",
    items: [
      { href: "/platform/accounts", icon: Building2, label: "Accounts" },
      { href: "/platform/users", icon: Users, label: "Users" },
      { href: "/platform/packages", icon: Package, label: "Packages" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/platform/settings", icon: Settings, label: "System Settings" },
      { href: "/platform/global-variables", icon: SlidersHorizontal, label: "Global Variables" },
      { href: "/platform/card-templates", icon: Palette, label: "Card Templates" },
      { href: "/platform/templates", icon: FileText, label: "Email Templates" },
      { href: "/platform/rbac", icon: ShieldCheck, label: "Roles & Permissions" },
      { href: "/platform/webhooks", icon: Webhook, label: "Webhooks" },
      { href: "/platform/audit", icon: ScrollText, label: "Audit Log" },
      { href: "/platform/settings/ai", icon: Sparkles, label: "AI Integration" },
      { href: "/platform/settings/whatsapp", icon: MessageCircle, label: "WhatsApp Config" },
      { href: "/platform/settings/sms", icon: MessageSquare, label: "SMS Config" },
      { href: "/platform/settings/telegram", icon: Send, label: "Telegram Config" },
    ],
  },
  {
    title: "Insights",
    items: [{ href: "/platform/payments", icon: CreditCard, label: "Payments" }],
  },
];

const ACCOUNT_NAV: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/events", icon: CalendarDays, label: "Events", permission: "events:read" },
      { href: "/scanner", icon: ScanLine, label: "Scanner", permission: "scanner:read" },
      // ✅ NEW: Guest QR Management link for Account Admins/Event Managers
      { href: "/guests/qr-management", icon: QrCode, label: "Guest QR Codes", permission: "invitations:read" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/payments", icon: CreditCard, label: "Payments", permission: "payments:read" },
      { href: "/billing", icon: CreditCard, label: "Billing", permission: "payments:read" },
      { href: "/usage", icon: Gauge, label: "Usage & Limits", permission: "events:read" },
      { href: "/reports", icon: BarChart3, label: "Reports", permission: "reports:read" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/audit", icon: ScrollText, label: "Audit Log", permission: "audit:read" },
      { href: "/settings", icon: Settings, label: "Settings" },
      { href: "/profile", icon: UserCircle, label: "My Profile" },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = router.pathname;
  const { user, logout } = useAuth();
  const platform = isPlatformAdmin(user?.role);

  const sections = (platform ? PLATFORM_NAV : ACCOUNT_NAV)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || can(user?.role, item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 flex h-screen flex-col bg-navy-950 text-white transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600">
          <Crown className="h-5 w-5 text-navy-950" />
        </div>
        {!collapsed && (
          <div className="animate-fadeIn">
            <h1 className="text-base font-bold leading-tight">RoyalEntry</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              {platform ? "Platform Console" : "Client Workspace"}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map(({ href, icon: Icon, label }) => {
                const isActive =
                  href === "/platform" ? pathname === "/platform" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive ? "bg-gold-500/15 text-gold-400" : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />
                      )}
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <div className={cn("mb-2 flex items-center gap-3 rounded-lg bg-white/5 p-2.5", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.full_name}</p>
              <p className="truncate text-[10px] text-slate-400">{roleLabel(user?.role)}</p>
            </div>
          )}
          {!collapsed && (
            <div className="flex items-center gap-1">
              <Link href="/profile" className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white" title="My Profile">
                <UserCircle className="h-4 w-4" />
              </Link>
              <button onClick={logout} className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white",
            collapsed && "px-0"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (<><ChevronLeft className="h-4 w-4" /> Collapse</>)}
        </button>
      </div>
    </aside>
  );
}
