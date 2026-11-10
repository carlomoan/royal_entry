"use client";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { getQueue, useOnlineStatus } from "@/lib/offline";
import { cacheSize } from "@/lib/cache";
import { syncOfflineQueue } from "@/lib/api";
import toast from "react-hot-toast";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const [queued, setQueued] = useState(getQueue().length);
  const [cached, setCached] = useState(cacheSize());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => { setQueued(getQueue().length); setCached(cacheSize()); };
    window.addEventListener("storage", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);

  if (online && queued === 0) return null;

  const syncNow = async () => {
    setSyncing(true);
    const n = await syncOfflineQueue();
    setQueued(getQueue().length);
    setSyncing(false);
    if (n > 0) toast.success(`Synced ${n} change(s)`);
  };

  return (
    <div className={`flex items-center justify-between gap-3 px-6 py-2 text-sm ${online ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>
      <div className="flex items-center gap-2">
        {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
        <span>
          {online
            ? `${queued} change(s) waiting to sync`
            : `You're offline — ${cached} cached item(s) available · changes will sync when you're back online`}
        </span>
      </div>
      {queued > 0 && (
        <button
          onClick={syncNow}
          disabled={syncing || !online}
          className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold transition hover:bg-white/30 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync now
        </button>
      )}
    </div>
  );
}