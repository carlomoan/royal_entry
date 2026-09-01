import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";

// Disable SSR for the entire app — auth state depends on localStorage
const NoSSR = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => <>{children}</>), {
  ssr: false,
});

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();

  // Login page is standalone (no sidebar/topbar/footer)
  const isLogin = router.pathname === "/login";

  return (
    <NoSSR>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {isLogin ? (
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
  );
}