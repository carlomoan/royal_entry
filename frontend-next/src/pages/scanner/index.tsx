"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import {
  ScanLine, Search, MapPin, CalendarDays, ArrowRight, Zap, Hash, QrCode,
} from "lucide-react";
import api from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

export default function ScannerHub() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "upcoming">("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events-scanner-hub"],
    queryFn: async () => (await api.get("/events?per_page=100")).data.data,
  });

  const filtered = useMemo(() => {
    return (events as any[]).filter((e) => {
      const matchesSearch = e.title?.toLowerCase().includes(search.toLowerCase()) ||
                            e.venue_name?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && e.status === "active") ||
        (filter === "upcoming" && e.status === "approved");
      return matchesSearch && matchesFilter;
    });
  }, [events, search, filter]);

  const activeEvents = (events as any[]).filter((e) => e.status === "active");

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      {/* Sticky Mobile Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-4 shadow-sm md:px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30">
            <ScanLine className="h-6 w-6 text-navy-950" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Guest Scanner</h1>
            <p className="text-xs text-slate-500">Select an event to start</p>
          </div>
          {/* Quick Scan: If only one event is live, show instant button */}
          {activeEvents.length === 1 && (
            <button
              onClick={() => router.push(`/events/${activeEvents[0].id}/scanner`)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-md active:scale-95 transition"
            >
              <Zap className="h-3.5 w-3.5" /> Quick Scan
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 transition"
          />
        </div>

        {/* Filter Chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(["all", "active", "upcoming"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition",
                filter === f ? "bg-navy-950 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200"
              )}
            >
              {f} {f !== "all" && `(${(events as any[]).filter(e => e.status === (f === 'upcoming' ? 'approved' : f)).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Event Grid */}
      <div className="px-4 py-4 md:px-6 md:py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <QrCode className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700">No events found</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              {search ? "Try a different search term" : "Create an event and add guests to start scanning"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event: any) => {
              const scanned = event.guests_arrived || 0;
              const total = event.guest_count_expected || 0;
              const progress = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
              const isActive = event.status === "active";

              return (
                <button
                  key={event.id}
                  onClick={() => router.push(`/events/${event.id}/scanner`)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition-all active:scale-[0.98] md:p-5",
                    isActive ? "border-gold-400/50 ring-1 ring-gold-400/20" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  {isActive && (
                    <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-700">LIVE</span>
                    </div>
                  )}

                  <div className="mb-3">
                    <h3 className="pr-16 text-base font-bold text-slate-900 line-clamp-2 group-hover:text-gold-700 transition">
                      {event.title}
                    </h3>
                    {event.venue_name && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{event.venue_name}</span>
                      </div>
                    )}
                  </div>

                  {total > 0 && (
                    <div className="mt-auto">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600">
                          <span className="font-bold text-slate-900">{scanned}</span> / {total} guests
                        </span>
                        <span className="font-bold text-gold-600">{progress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            progress === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-gold-400 to-gold-600"
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs font-medium text-slate-400 group-hover:text-gold-600 transition">Open Scanner</span>
                    <ArrowRight className="h-4 w-4 text-gold-600 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile FAB for Manual Entry (when QR fails) */}
      <div className="fixed bottom-6 right-6 md:hidden z-30">
        <button
          onClick={() => activeEvents.length > 0 && router.push(`/events/${activeEvents[0].id}/scanner?mode=manual`)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-950 text-white shadow-xl shadow-navy-950/30 active:scale-90 transition"
          title="Manual Code Entry"
        >
          <Hash className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
