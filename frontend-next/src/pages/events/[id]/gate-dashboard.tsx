"use client";
// Live gate overview: arrival counts, table occupancy and a searchable guest list.
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, RefreshCw, Users, UserCheck, UserX, TrendingUp, Search, AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { Card, Badge, StatCard, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type GateTable = {
  table_number: string;
  capacity: number;
  seated: number;
  company_name: string | null;
};

type GateGuest = {
  guest_id: string;
  full_name: string;
  phone: string;
  table_number: string | null;
  seat_number: string | null;
  guest_category: string | null;
  party_size: number;
  entries_used: number;
  arrived: boolean;
  company_name: string | null;
  package_name: string | null;
};

type GateDashboardData = {
  expected_count: number;
  arrived_count: number;
  tables: GateTable[];
  guests: GateGuest[];
};

const dash = (value: string | number | null | undefined) =>
  value == null || value === "" ? "—" : value;

export default function GateDashboardPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["gate-dashboard", id],
    queryFn: async () =>
      (await api.get(`/events/${id}/gate-dashboard`)).data.data as GateDashboardData,
    refetchInterval: 15_000,
    enabled: !!id && id !== "undefined",
  });

  const guests = data?.guests ?? [];
  const tables = data?.tables ?? [];
  const expected = data?.expected_count ?? 0;
  const arrived = data?.arrived_count ?? 0;
  const stillExpected = Math.max(0, expected - arrived);
  const arrivalRate = expected > 0 ? Math.round((arrived / expected) * 100) : 0;

  const filteredGuests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return guests;
    return guests.filter((g) =>
      [g.full_name, g.phone, g.table_number, g.company_name]
        .some((value) => value != null && String(value).toLowerCase().includes(needle))
    );
  }, [guests, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-navy-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/events/${id}`)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20"
              aria-label="Back to event"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Gate dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">
                Live view of arrivals, seating and guest status at the gate.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            Live · refreshes every 15s
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </div>
        </div>
        {dataUpdatedAt > 0 && (
          <p className="mt-3 text-right text-[11px] text-slate-400">
            Last updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading gate dashboard…</p>
      ) : isError ? (
        <Card title="Gate dashboard">
          <p className="text-sm text-rose-700">Could not load the gate dashboard. Retrying automatically…</p>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Expected" value={expected} icon={Users} color="blue" subtitle="Guests on the list" />
            <StatCard title="Arrived" value={arrived} icon={UserCheck} color="green" subtitle="Checked in at the gate" />
            <StatCard title="Still expected" value={stillExpected} icon={UserX} color="gold" subtitle="Not yet arrived" />
            <StatCard title="Arrival rate" value={`${arrivalRate}%`} icon={TrendingUp} color="purple" subtitle="Of expected guests" />
          </div>

          {/* Tables */}
          <Card title="Tables">
            {tables.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No tables configured for this event.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5">Table</th>
                      <th className="px-3 py-2.5">Company</th>
                      <th className="px-3 py-2.5">Seated</th>
                      <th className="px-3 py-2.5">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tables.map((table) => {
                      const full = table.capacity > 0 && table.seated >= table.capacity;
                      const pct = table.capacity > 0
                        ? Math.min(100, Math.round((table.seated / table.capacity) * 100))
                        : 0;
                      return (
                        <tr key={table.table_number} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-semibold text-navy-950">{table.table_number}</td>
                          <td className="px-3 py-3 text-slate-600">{table.company_name ?? <span className="text-slate-400">Open/shared</span>}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{table.seated} / {table.capacity}</span>
                              {full && (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                  <Badge label="Full" variant="rose" />
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="h-2 w-full min-w-[120px] rounded-full bg-slate-100">
                              <div
                                className={cn("h-2 rounded-full transition-all", full ? "bg-rose-500" : "bg-gold-500")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Guests */}
          <Card title="Guests">
            <div className="relative mb-4 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, phone, table or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {filteredGuests.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                {guests.length === 0 ? "No guests to show." : "No guests match your search."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Phone</th>
                      <th className="px-3 py-2.5">Table</th>
                      <th className="px-3 py-2.5">Seat</th>
                      <th className="px-3 py-2.5">Class/Package</th>
                      <th className="px-3 py-2.5">Party</th>
                      <th className="px-3 py-2.5">Entries</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredGuests.map((guest) => {
                      const primaryClass = guest.guest_category ?? guest.package_name;
                      const secondaryClass =
                        guest.guest_category && guest.package_name ? guest.package_name : null;
                      return (
                        <tr key={guest.guest_id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-semibold text-slate-900">{dash(guest.full_name)}</td>
                          <td className="px-3 py-3 text-slate-600">{dash(guest.phone)}</td>
                          <td className="px-3 py-3 text-slate-600">{dash(guest.table_number)}</td>
                          <td className="px-3 py-3 text-slate-600">{dash(guest.seat_number)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col">
                              <span className="text-slate-700">{dash(primaryClass)}</span>
                              {secondaryClass && <span className="text-[11px] text-slate-400">{secondaryClass}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{guest.party_size}</td>
                          <td className="px-3 py-3 text-slate-600">{guest.entries_used}</td>
                          <td className="px-3 py-3">
                            <Badge
                              label={guest.arrived ? "Arrived" : "Expected"}
                              variant={guest.arrived ? "green" : "pending"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
