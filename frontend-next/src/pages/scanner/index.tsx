"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/router";
import {
  ScanLine, CalendarDays, MapPin, Search, ArrowRight, Users,
} from "lucide-react";
import api from "@/lib/api";
import { Card, Badge, Button, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function ScannerHubPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data: response, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get("/events?page=1&per_page=100")).data,
  });

  const events = response?.data ?? [];
  const filtered = events.filter((e: any) =>
    !query || (e.title?.toLowerCase().includes(query.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30">
            <ScanLine className="h-6 w-6 text-navy-950" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Guest Scanner</h1>
            <p className="text-sm text-slate-500">Select an event to start scanning guests</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search events..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading events…</p>
      ) : filtered.length === 0 ? (
        <Card><div className="py-12 text-center">
          <ScanLine className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium text-slate-600">No events to scan</p>
          <p className="text-xs text-slate-400">Create an event and add guests to start scanning</p>
        </div></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event: any) => (
            <button
              key={event.id}
              onClick={() => router.push(`/events/${event.id}/scanner`)}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-md animate-fadeIn"
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <Badge label={event.status} />
                  <span className="text-xs text-slate-400">{formatDate(event.event_date)}</span>
                </div>
                <h3 className="text-lg font-bold leading-snug text-slate-900 group-hover:text-gold-700">
                  {event.title}
                </h3>
                {event.venue_name && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{event.venue_name}</span>
                  </div>
                )}
                {event.guest_count_expected && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Users className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{event.guest_count_expected} expected guests</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">Open scanner</span>
                <ArrowRight className="h-4 w-4 text-gold-600 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}