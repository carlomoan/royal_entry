// ==============================================================================
// FILE: src/App.tsx
// ==============================================================================

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import PublicInvitation from "@/pages/PublicInvitation";
import { isPlatformAdmin } from "@/utils/roles";

// ── Lazy imports: Account pages ──────────────────────────────────────────
import Dashboard from "@/pages/Dashboard";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import Guests from "@/pages/Guests";
import Michango from "@/pages/Michango";
import Broadcast from "@/pages/Broadcast";
import Scanner from "@/pages/Scanner";
import CardStudio from "@/pages/CardStudio";
import CardCustomizer from "@/pages/CardCustomizer";
import AccountPayments from "@/pages/Payments";
import AccountReports from "@/pages/Reports";
import AccountAudit from "@/pages/Audit";
import AccountSettings from "@/pages/AccountSettings";

// ── Lazy imports: Platform pages (superadmin/platform_admin/system_admin) ─
import PlatformDashboard from "@/pages/Platform";
import PlatformAccounts from "@/pages/platform/Accounts";
import PlatformRbac from "@/pages/platform/PlatformRbac";
import PlatformPackages from "@/pages/platform/Packages";
import PlatformAudit from "@/pages/platform/PlatformAudit";
import PlatformSettings from "@/pages/platform/PlatformSettings";
import PlatformTemplates from "@/pages/platform/CardTemplatesAdmin";
import PlatformUsers from "@/pages/platform/PlatformUsers";
import PlatformWebhooks from "@/pages/platform/Webhooks";
import PlatformGlobalVariables from "@/pages/platform/GlobalVariables";

// ── Guard: redirect to /login if not authenticated ────────────────────────
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// ── Guard: only platform roles can access these routes ────────────────────
const RequirePlatform: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (!isPlatformAdmin(user?.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// ── Guard: account users only (not platform) ──────────────────────────────
const RequireAccount: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (isPlatformAdmin(user?.role)) return <Navigate to="/platform" replace />;
  return <>{children}</>;
};

const FullPageSpinner = () => (
  <div className="min-h-screen bg-navy-900 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          {/* ── Public routes (no auth) ─────────────────────────────────── */}
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:code" element={<PublicInvitation />} />

          {/* ── Authenticated routes (shared layout) ────────────────────── */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            {/* ── Index redirect ─────────────────────────────────────── */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* ── Account (tenant) routes ───────────────────────────── */}
            <Route element={<RequireAccount><Outlet /></RequireAccount>}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="events" element={<Events />} />
              <Route path="events/:id" element={<EventDetail />} />
              <Route path="events/:id/guests" element={<Guests />} />
              <Route path="events/:id/michango" element={<Michango />} />
              <Route path="events/:id/broadcast" element={<Broadcast />} />
              <Route path="events/:id/scanner" element={<Scanner />} />
              <Route path="events/:id/cards" element={<CardStudio />} />
              <Route path="events/:id/customize" element={<CardCustomizer />} />
              <Route path="payments" element={<AccountPayments />} />
              <Route path="reports" element={<AccountReports />} />
              <Route path="audit" element={<AccountAudit />} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>

            {/* ── Platform (SaaS) routes ─────────────────────────────── */}
            <Route element={<RequirePlatform><Outlet /></RequirePlatform>}>
              <Route path="platform" element={<PlatformDashboard />} />
              <Route path="platform/accounts" element={<PlatformAccounts />} />
              <Route path="platform/packages" element={<PlatformPackages />} />
              <Route path="platform/users" element={<PlatformUsers />} />
              <Route path="platform/webhooks" element={<PlatformWebhooks />} />
              <Route path="platform/payments" element={<AccountPayments />} />
              <Route path="platform/rbac" element={<PlatformRbac />} />
              <Route path="platform/audit" element={<PlatformAudit />} />
              <Route path="platform/settings" element={<PlatformSettings />} />
              <Route path="platform/templates" element={<PlatformTemplates />} />
              <Route path="platform/global-variables" element={<PlatformGlobalVariables />} />
              <Route path="platform/card-templates" element={<PlatformTemplates />} />
            </Route>
          </Route>

          {/* ── Catch-all ──────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}