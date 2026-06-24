// ==============================================================================
// FILE: src/App.tsx
// ==============================================================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import Guests from "@/pages/Guests";
import Michango from "@/pages/Michango";
import Broadcast from "@/pages/Broadcast";
import Scanner from "@/pages/Scanner";
import Payments from "@/pages/Payments";

// Guard: redirect to /login if not authenticated
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="events/:id/guests" element={<Guests />} />
            <Route path="events/:id/michango" element={<Michango />} />
            <Route path="events/:id/broadcast" element={<Broadcast />} />
            <Route path="events/:id/scanner" element={<Scanner />} />
            <Route path="payments" element={<Payments />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
