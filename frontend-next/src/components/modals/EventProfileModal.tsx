"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays, MapPin, Users, UserCheck, Clock, Banknote,
  ShieldCheck, ArrowRight, X,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

interface EventProfileModalProps {
  eventId: string;
  onClose: () => void;
}

export function EventProfileModal({ eventId, onClose }: EventProfileModalProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["event-profile-modal", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/summary`)).data.data,
  });

  if (isLoading) {
    return (
      <Overlay onClose={onClose}>
        <p className="text-sm text-slate-500">Loading profile…</p>
      </Overlay>
    );
  }

  if (!summary) {
    return (
      <Overlay onClose={onClose}>
        <p className="py-8 text-center text-sm text-slate-400">Event not found</p>
      </Overlay>
    );
  }

  const { event, summary: stats } = summary;

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div className="relative bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 p-6">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-white/70 transition hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <Badge label={event.status} className="bg-white/15 text-white" />
        <h2 className="mt-2 text-xl font-bold text-white">{event.title}</h2>
        <p className="text-sm text-slate-400">{event.venue_name ?? "Venue not set"} · {formatDate(event.event_date)}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 border-b border-slate-100 p-5">
        <ModalStat icon={Users} label="Guests" value={stats.total_guests} />
        <ModalStat icon={UserCheck} label="Arrived" value={stats.guests_arrived} />
        <ModalStat icon={ShieldCheck} label="Confirmed" value={stats.rsvp_confirmed} />
        <ModalStat icon={Clock} label="Declined" value={stats.rsvp_declined} />
        <ModalStat icon={CalendarDays} label="Invites" value={stats.invitations_sent} />
        <ModalStat icon={Banknote} label="Michango" value={`TZS ${(stats.michango_collected_tsh / 1000).toFixed(0)}k`} />
      </div>

      {/* Details */}
      <div className="space-y-2.5 p-5">
        <DetailRow icon={CalendarDays} label="Date" value={formatDate(event.event_date)} />
        <DetailRow icon={Clock} label="Time" value={event.event_time ?? "—"} />
        <DetailRow icon={MapPin} label="Venue" value={event.venue_name ?? "—"} />
        <DetailRow icon={MapPin} label="Address" value={event.venue_address ?? "—"} />
        <DetailRow icon={ShieldCheck} label="Dress Code" value={event.dress_code ?? "—"} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
        <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>
        <Link
          href={`/events/${eventId}`}
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-600"
        >
          Open Event <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl animate-scaleIn max-h-[85vh] flex flex-col">
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalStat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-gold-600" />
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /> {label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}