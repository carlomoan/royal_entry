"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, MapPin, Users, UserCheck, Clock,
  Banknote, CreditCard, Radio, ShieldCheck, Activity, Palette,
} from "lucide-react";
import { useRouter } from "next/router";
import api from "@/lib/api";
import { Card, Badge, StatCard } from "@/components/ui";
import { formatDate, formatTZS } from "@/lib/utils";

export default function EventProfilePage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const { data: summary, isLoading } = useQuery({
    queryKey: ["event-summary", id],
    queryFn: async () => (await api.get(`/events/${id}/summary`)).data.data,
  });

  const { data: guests = [] } = useQuery({
    queryKey: ["guests", id],
    queryFn: async () => (await api.get(`/events/${id}/guests`)).data.data,
  });

  if (isLoading || !summary) return <p className="text-sm text-slate-500">Loading…</p>;

  const { event, summary: stats } = summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
          <p className="text-sm text-slate-500">Event Profile</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Guests" value={stats.total_guests} icon={Users} color="blue" />
        <StatCard title="Arrived" value={stats.guests_arrived} icon={UserCheck} color="green" />
        <StatCard title="Confirmed" value={stats.rsvp_confirmed} icon={ShieldCheck} color="gold" />
        <StatCard title="Declined" value={stats.rsvp_declined} icon={Activity} color="red" />
        <StatCard title="Invites Sent" value={stats.invitations_sent} icon={Radio} color="purple" />
        <StatCard title="Michango" value={formatTZS(stats.michango_collected_tsh)} icon={Banknote} color="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Event info */}
        <Card title="Event Information">
          <div className="space-y-3">
            <Row icon={CalendarDays} label="Event Date" value={formatDate(event.event_date)} />
            <Row icon={Clock} label="Time" value={event.event_time ?? "—"} />
            <Row icon={MapPin} label="Venue" value={event.venue_name ?? "—"} />
            <Row icon={MapPin} label="Address" value={event.venue_address ?? "—"} />
            <Row icon={ShieldCheck} label="Status" value={<Badge label={event.status} />} />
            <Row icon={CreditCard} label="Dress Code" value={event.dress_code ?? "—"} />
            <Row icon={Palette} label="Card Theme" value={event.card_theme ?? "—"} />
          </div>
        </Card>

        {/* Guest list */}
        <Card title={`Guest List (${guests.length})`}>
          {!guests.length ? (
            <p className="py-8 text-center text-sm text-slate-400">No guests registered</p>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {guests.map((g: any) => (
                <div key={g.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-950 text-xs font-bold text-gold-400">
                    {g.full_name?.[0]?.toUpperCase() ?? "G"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{g.full_name}</p>
                    <p className="truncate text-xs text-slate-500">{g.phone} · {g.guest_category ?? "Regular"}</p>
                  </div>
                  <Badge label={g.rsvp_response ?? "pending"} variant={
                    g.rsvp_response === "confirmed" ? "green" :
                    g.rsvp_response === "declined" ? "rose" : "slate"
                  } />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Staff assignment */}
        <EventStaffProfileTab eventId={id} />
      </div>
    </div>
  );
}

function EventStaffProfileTab({ eventId }: { eventId: string }) {
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["event-staff", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/staff`)).data.data,
  });
  const staff = staffData ?? [];

  return (
    <Card title="Event Staff">
      <div className="mb-3 text-sm text-slate-500">Assigned staff members for this event.</div>
      {staffLoading ? (
        <p className="text-sm text-slate-500">Loading staff…</p>
      ) : staff.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No staff assigned yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200">
              {["Name", "Email", "Role", "Assigned"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s: any) => (
                <tr key={s.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.user_full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.user_email}</td>
                  <td className="px-4 py-3"><Badge label={s.user_role} variant="blue" /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Row({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}