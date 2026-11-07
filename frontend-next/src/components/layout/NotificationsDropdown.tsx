"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, CheckCheck, Crown, CreditCard, Receipt, Radio,
  CheckCircle2, XCircle, Inbox, X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";

function iconFor(type: string) {
  if (type.startsWith("guest.vip")) return { Icon: Crown, cls: "bg-gold-50 text-gold-700" };
  if (type.startsWith("payment")) return { Icon: CreditCard, cls: "bg-emerald-50 text-emerald-700" };
  if (type.startsWith("event.approved")) return { Icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700" };
  if (type.startsWith("event.rejected")) return { Icon: XCircle, cls: "bg-rose-50 text-rose-700" };
  if (type.startsWith("event.submitted")) return { Icon: Radio, cls: "bg-sky-50 text-sky-700" };
  if (type.startsWith("invoice") || type.startsWith("subscription") || type.startsWith("account"))
    return { Icon: Receipt, cls: "bg-amber-50 text-amber-700" };
  if (type.startsWith("broadcast")) return { Icon: Radio, cls: "bg-sky-50 text-sky-700" };
  return { Icon: Bell, cls: "bg-slate-100 text-slate-600" };
}

const POLL_MS = 15_000;

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const qc = useQueryClient();

  // Unread badge count — polled + refreshed on window focus.
  const { data: countData } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => (await api.get("/notifications/unread-count")).data.data,
    refetchInterval: POLL_MS,
    retry: false,
  });
  const unread: number = countData?.count ?? 0;

  // Dropdown list (fetched when opened).
  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications?limit=20")).data.data ?? [],
    enabled: open,
    retry: false,
  });

  // Latest notification — drives live popup alerts.
  const { data: latest = [] } = useQuery({
    queryKey: ["notifications-latest"],
    queryFn: async () => (await api.get("/notifications?limit=1")).data.data ?? [],
    refetchInterval: POLL_MS,
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-latest"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const markOne = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSettled: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSettled: invalidate,
  });

  // ── Live popup alerts ──────────────────────────────────────────────────────
  const seenTopId = useRef<string | null>(null);

  useEffect(() => {
    const top = latest[0];
    if (!top) return;
    // First poll seeds the baseline so we don't toast history.
    if (seenTopId.current === null) {
      seenTopId.current = top.id;
      return;
    }
    if (top.id === seenTopId.current) return;

    seenTopId.current = top.id;
    // Don't interrupt behind a background tab with a popup.
    if (document.visibilityState === "hidden") return;

    const { Icon, cls } = iconFor(top.type);
    const toastId = toast.custom(
      (t) => (
        <div
          className={cn(
            "pointer-events-auto flex w-80 max-w-[92vw] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl transition",
            t.visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          )}
        >
          <span className={cn("mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", cls)}>
            <Icon className="h-5 w-5" />
          </span>
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              toast.dismiss(toastId);
              if (!top.is_read) markOne.mutate(top.id);
              if (top.link) router.push(top.link);
            }}
          >
            <p className="truncate text-sm font-semibold text-slate-800">{top.title}</p>
            {top.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{top.body}</p>}
            <p className="mt-1 text-[10px] text-slate-400">{timeAgo(top.created_at)} · click to view</p>
          </button>
          <button
            onClick={() => toast.dismiss(toastId)}
            className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      { duration: 8000, position: "bottom-right" }
    );
  }, [latest, router, markOne]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const openItem = (n: any) => {
    if (!n.is_read) markOne.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[92vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            <button
              onClick={() => markAll.mutate()}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 transition hover:text-gold-800 disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                <p className="text-sm text-slate-400">You're all caught up</p>
              </div>
            ) : (
              items.map((n: any) => {
                const { Icon, cls } = iconFor(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50",
                      !n.is_read && "bg-gold-50/40"
                    )}
                  >
                    <span className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", cls)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{n.title}</span>
                        {!n.is_read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-gold-500" />}
                      </span>
                      {n.body && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span>}
                      <span className="mt-0.5 block text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}