"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarDays, MapPin, Users, ExternalLink } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { EventProfileModal } from "@/components/modals/EventProfileModal";

export default function EventsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [profileEventId, setProfileEventId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => (await api.get("/events?page=1&per_page=50")).data,
  });
  const events = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/events", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setShowCreate(false); toast.success("Event created"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    createMutation.mutate({
      title: (f.elements.namedItem("title") as HTMLInputElement).value,
      event_date: (f.elements.namedItem("event_date") as HTMLInputElement).value,
      venue_name: (f.elements.namedItem("venue_name") as HTMLInputElement).value || undefined,
      main_characters: (f.elements.namedItem("main_characters") as HTMLInputElement).value || undefined,
      guest_count_expected: (f.elements.namedItem("guest_count_expected") as HTMLInputElement).value ? parseInt((f.elements.namedItem("guest_count_expected") as HTMLInputElement).value, 10) : undefined,
      send_save_the_date: (f.elements.namedItem("send_save_the_date") as HTMLInputElement).checked,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="text-sm text-slate-500">{events.length} events total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Event</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : events.length === 0 ? (
        <Card><div className="py-16 text-center"><CalendarDays className="mx-auto mb-4 h-14 w-14 text-slate-200" /><h3 className="font-semibold text-slate-700">No events yet</h3><p className="mt-1 text-sm text-slate-500">Create your first event to get started</p><Button className="mt-4" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Create Event</Button></div></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event: any) => (
            <div key={event.id} className="group relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-gold-300 hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <Badge label={event.status} />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setProfileEventId(event.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-gold-300 hover:text-gold-700"
                    title="View event profile"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Profile
                  </button>
                  <span className="text-xs text-slate-400">{formatDate(event.event_date)}</span>
                </div>
              </div>
              {event.status === "draft" && (
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  <strong>Draft.</strong> Submit for approval, then activate to allow check-ins and invite sending.
                </div>
              )}
              {event.status === "approved" && (
                <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-800">
                  <strong>Approved.</strong> Set the entry window and click <em>Activate</em> on the event page to begin check-ins.
                </div>
              )}
              <Link href={`/events/${event.id}`} className="block">
                <h3 className="text-lg font-bold leading-snug text-slate-900 group-hover:text-gold-700">{event.title}</h3>
              </Link>
              <div className="mt-3 space-y-1.5">
                {event.venue_name && (
                  <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{event.venue_name}</span></div>
                )}
                {event.guest_count_expected && (
                  <div className="flex items-center gap-2 text-sm text-slate-600"><Users className="h-3.5 w-3.5 flex-shrink-0" /><span>{event.guest_count_expected} expected guests</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {profileEventId && (
        <EventProfileModal eventId={profileEventId} onClose={() => setProfileEventId(null)} />
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Event" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Event Title *" name="title" placeholder="Amina & Ahmed Wedding" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Event Date *" name="event_date" type="date" required />
            <Input label="Venue Name" name="venue_name" />
          </div>
          <Input label="Main Characters / Speakers" name="main_characters" placeholder="e.g. MC Juma, DJ B, Pastor John" />
          <Input label="Expected Guests" name="guest_count_expected" type="number" />
          <label className="flex items-center gap-3">
            <input type="checkbox" name="send_save_the_date" defaultChecked className="h-4 w-4 rounded accent-gold-500" />
            <span className="text-sm font-medium text-slate-700">Send Save the Date</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}