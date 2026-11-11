"use client";
// ==============================================================================
// Idle session timeout — logs the user out after a period of inactivity so a
// forgotten session can't stay open (e.g. overnight). After expiry the user
// must sign in again (identity confirmation) on the login page, which shows a
// "session expired" notice.
//
// Timeout is configurable via NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES (default 2).
// ==============================================================================
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/lib/auth";

const DEFAULT_IDLE_MINUTES = 2;
const CHECK_INTERVAL_MS = 15_000;

export default function IdleSessionTimeout() {
  const { isAuthenticated, logout, user } = useAuth();
  const router = useRouter();

  const lastActivity = useRef<number>(Date.now());
  const timeoutMs = useRef<number>(
    (parseInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? "", 10) || DEFAULT_IDLE_MINUTES) * 60_000
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    // Scanner attendants work at the gate — never log them out for inactivity.
    if (user?.role === "scanner_attendant") return;

    const bump = () => {
      lastActivity.current = Date.now();
    };

    // Any user interaction resets the idle clock.
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "mousemove",
      "touchstart",
      "scroll",
    ];
    events.forEach((event) => window.addEventListener(event, bump, { passive: true }));

    const expire = () => {
      // Never expire while the user is already on the login page.
      if (router.pathname === "/login") return;
      try {
        localStorage.setItem("session_expired", "idle");
      } catch {
        /* storage unavailable — proceed anyway */
      }
      logout();
    };

    const check = () => {
      if (Date.now() - lastActivity.current >= timeoutMs.current) {
        expire();
      }
    };

    // Periodic check (also covers throttled background tabs).
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    // When the tab becomes visible again, expire immediately if idle long enough.
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((event) => window.removeEventListener(event, bump));
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, router.pathname, logout, user?.role]);

  return null;
}