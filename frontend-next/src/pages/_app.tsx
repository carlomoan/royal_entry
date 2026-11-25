import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { Component, useState, type ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import IdleSessionTimeout from "@/components/auth/IdleSessionTimeout";

// Disable SSR for the entire app — auth state depends on localStorage
const NoSSR = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false,
});

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("RoyalEntry render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">This page could not be displayed</h1>
          <p className="mt-2 break-words font-mono text-xs text-rose-700">{this.state.error.message}</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.assign("/dashboard"); }}
            className="mt-4 rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();

  // Login and guest-facing public pages are standalone (no sidebar/auth shell).
  const isLogin = router.pathname === "/login";
  const isPublicGuestPage =
    router.pathname.startsWith("/invoice/") ||
    router.pathname.startsWith("/i/") ||
    router.pathname.startsWith("/g/") ||
    router.pathname.startsWith("/w/") ||
    router.pathname.startsWith("/b/");

  return (
    <AppErrorBoundary>
      <NoSSR>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <IdleSessionTimeout />
            {isLogin || isPublicGuestPage ? (
              <Component {...pageProps} />
            ) : (
              <AppShell>
                <Component {...pageProps} />
              </AppShell>
            )}
            <Toaster position="top-right" />
          </AuthProvider>
        </QueryClientProvider>
      </NoSSR>
    </AppErrorBoundary>
  );
}