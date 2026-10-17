"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";
import { isPlatformAdmin } from "@/lib/roles";
import { LogOut } from "lucide-react";

function getHomePath(role?: string | null): string {
  if (isPlatformAdmin(role)) return "/platform";
  if (role === "scanner_attendant") return "/scanner";
  if (role === "event_manager") return "/events";
  return "/dashboard";
}

function Shell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, isImpersonating, returnToSuperAdmin } = useAuth();
  const router = useRouter();
  const pathname = router.pathname;

  const platform = isPlatformAdmin(user?.role);
  const home = getHomePath(user?.role);
  const unassigned = !isLoading && isAuthenticated && !platform && !user?.organization_id;

  // ✅ Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { router.replace("/login"); return; }
    if (unassigned && pathname !== "/profile") { router.replace("/profile"); return; }
    if (pathname === "/") { router.replace(home); return; }
    if (!platform && pathname.startsWith("/platform")) router.replace(home);
  }, [isAuthenticated, isLoading, pathname, home, unassigned, router, platform]);

  // ✅ Close mobile menu when navigating to a new page
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold-400 border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) return null;
  if (unassigned && pathname !== "/profile") return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {isImpersonating && (
          <div className="flex items-center justify-between gap-4 bg-navy-950 px-6 py-2.5 text-white">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-gold-400" />
              <span>
                You are viewing as <strong className="text-gold-400">{user?.full_name}</strong> ({user?.email})
              </span>
            </div>
            <button
              onClick={returnToSuperAdmin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-950 transition hover:bg-gold-600"
            >
              <LogOut className="h-3.5 w-3.5" /> Return to Super Admin
            </button>
          </div>
        )}
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <CommandPalette />
        <main className="flex-1 p-6">{children}</main>
        <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} RoyalEntry · Elite Access Solutions
        </footer>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
