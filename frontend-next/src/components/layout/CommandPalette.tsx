"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Search, CornerDownLeft, LogOut, PanelLeftClose,
  LayoutDashboard, Building2, Users, Package, CreditCard, Settings,
  SlidersHorizontal, Palette, ShieldCheck, Webhook, ScrollText,
  CalendarDays, ScanLine, FileText, Gauge, BarChart3, UserCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { can, isPlatformAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  keywords?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  run: () => void;
}

function scoreCommand(c: Command, q: string): number {
  const label = c.label.toLowerCase();
  const kw = (c.keywords ?? "").toLowerCase();
  if (label === q) return 5;
  if (label.startsWith(q)) return 4;
  if (label.includes(q)) return 3;
  if (kw.includes(q)) return 2;
  return 0;
}

export default function CommandPalette() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const platform = isPlatformAdmin(user?.role);

  // ── Global shortcuts: ⌘K / Ctrl+K to toggle, Esc to close ────────────────
  useEffect(() => {
    const openHandler = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("royalentry:open-command", openHandler);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("royalentry:open-command", openHandler);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Focus + reset when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // ── Build role-aware command list ─────────────────────────────────────────
  const commands = useMemo<Command[]>(() => {
    const nav = (href: string) => () => router.push(href);
    const cmds: Command[] = [];

    if (platform) {
      cmds.push(
        { id: "p-overview", label: "Platform Overview", keywords: "home dashboard saas analytics", icon: LayoutDashboard, group: "Platform", run: nav("/platform") },
        { id: "p-accounts", label: "Accounts", keywords: "customers organizations tenants approve", icon: Building2, group: "Platform", run: nav("/platform/accounts") },
        { id: "p-users", label: "Users", keywords: "people staff members assign", icon: Users, group: "Platform", run: nav("/platform/users") },
        { id: "p-packages", label: "Packages", keywords: "plans pricing tiers limits", icon: Package, group: "Platform", run: nav("/platform/packages") },
        { id: "p-payments", label: "Platform Payments", keywords: "transactions revenue mpesa", icon: CreditCard, group: "Platform", run: nav("/platform/payments") },
        { id: "p-settings", label: "System Settings", keywords: "config global configuration", icon: Settings, group: "Platform", run: nav("/platform/settings") },
        { id: "p-vars", label: "Global Variables", keywords: "config keys values", icon: SlidersHorizontal, group: "Platform", run: nav("/platform/global-variables") },
        { id: "p-cards", label: "Card Templates", keywords: "designs themes invitation cards", icon: Palette, group: "Platform", run: nav("/platform/card-templates") },
        { id: "p-rbac", label: "Roles & Permissions", keywords: "rbac access control security", icon: ShieldCheck, group: "Platform", run: nav("/platform/rbac") },
        { id: "p-webhooks", label: "Webhooks", keywords: "integrations api events callbacks", icon: Webhook, group: "Platform", run: nav("/platform/webhooks") },
        { id: "p-audit", label: "Audit Log", keywords: "security history activity", icon: ScrollText, group: "Platform", run: nav("/platform/audit") },
      );
    } else {
      const acct: Array<[string, string, string, React.ComponentType<{ className?: string }>, string, string | undefined]> = [
        ["a-dash", "Dashboard", "home overview", LayoutDashboard, "/dashboard", undefined],
        ["a-events", "Events", "weddings events create", CalendarDays, "/events", "events:read"],
        ["a-scanner", "Scanner", "check-in qr scan door kiosk", ScanLine, "/scanner", "scanner:read"],
        ["a-payments", "Payments", "mpesa transactions collections", CreditCard, "/payments", "payments:read"],
        ["a-billing", "Billing & Invoices", "subscription invoices plan renew", FileText, "/billing", "payments:read"],
        ["a-usage", "Usage & Limits", "plan limits consumption", Gauge, "/usage", "events:read"],
        ["a-reports", "Reports", "analytics export csv", BarChart3, "/reports", "reports:read"],
        ["a-audit", "Audit Log", "history activity log", ScrollText, "/audit", "audit:read"],
        ["a-settings", "Settings", "organization team members roles", Settings, "/settings", undefined],
        ["a-profile", "My Profile", "account me personal", UserCircle, "/profile", undefined],
      ];
      for (const [id, label, keywords, icon, href, perm] of acct) {
        if (perm && !can(user?.role, perm)) continue;
        cmds.push({ id, label, keywords, icon, group: "Navigate", run: nav(href) });
      }
    }

    // Actions available to everyone
    cmds.push(
      {
        id: "act-sidebar", label: "Toggle Sidebar", keywords: "collapse expand sidebar layout",
        icon: PanelLeftClose, group: "Actions",
        run: () => window.dispatchEvent(new Event("royalentry:toggle-sidebar")),
      },
      { id: "act-signout", label: "Sign Out", keywords: "logout exit sign out", icon: LogOut, group: "Actions", run: () => logout() },
    );
    return cmds;
  }, [platform, user, router, logout]);

  // ── Filtering + grouping ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands
      .map((c) => ({ c, s: scoreCommand(c, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [commands, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const flat = useMemo(() => groups.flatMap(([, cs]) => cs), [groups]);

  // Keep active item visible
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const run = useCallback((c: Command) => {
    close();
    c.run();
  }, [close]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const c = flat[active]; if (c) run(c); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={close} />
      <div className="relative mx-auto mt-[12vh] w-[92vw] max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-scaleIn">
        {/* Input row */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Type a command or search…"
            className="h-12 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">No results for “{query}”</p>
          ) : (
            groups.map(([group, cs]) => (
              <div key={group} className="mb-1">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</p>
                {cs.map((c) => {
                  const idx = flat.indexOf(c);
                  const isActive = idx === active;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      data-active={isActive}
                      onClick={() => run(c)}
                      onMouseEnter={() => setActive(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition",
                        isActive ? "bg-gold-50 text-gold-800" : "text-slate-600"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-gold-600" : "text-slate-400")} />
                      <span className="flex-1 text-left font-medium">{c.label}</span>
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-400">
          <span><kbd className="font-semibold">↑↓</kbd> navigate</span>
          <span><kbd className="font-semibold">↵</kbd> select</span>
          <span><kbd className="font-semibold">esc</kbd> close</span>
          <span className="ml-auto">RoyalEntry ⌘K</span>
        </div>
      </div>
    </div>
  );
}
