// src/pages/Events.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, CalendarDays, MapPin, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { eventsApi } from "@/api/events";
import type { CreateEventInput } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { formatDate } from "@/utils/format";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  event_date: z.string().min(1, "Event date is required"),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  dress_code: z.string().optional(),
  guest_count_expected: z.coerce.number().int().positive().optional(),
  rsvp_deadline: z.string().optional(),
  card_theme: z
    .enum(["elegant", "modern", "traditional", "colorful", "minimal"])
    .optional(),
  send_save_the_date: z.boolean().default(true),
});

type EventForm = z.infer<typeof schema>;

export default function Events() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => eventsApi.list(1, 50),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateEventInput) => eventsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setShowCreate(false);
      reset();
      toast.success("Event created!");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to create event";
      toast.error(message);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EventForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: EventForm) => {
    createMutation.mutate(data as CreateEventInput);
  };

  const events = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-slate-600 mt-1">
            {events.length} events total
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Event
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <CalendarDays className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700">No events yet</h3>
          <p className="text-sm text-slate-500 mt-1">
            Create your first event to get started
          </p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create Event
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gold-300 transition-all p-6 group"
            >
              <div className="flex items-center justify-between mb-4">
                <Badge label={event.status} />
                <span className="text-xs text-slate-500">
                  {formatDate(event.event_date)}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-lg leading-snug group-hover:text-gold-600 transition-colors">
                {event.title}
              </h3>
              <div className="mt-3 space-y-1.5">
                {event.venue_name && (
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{event.venue_name}</span>
                  </div>
                )}
                {event.guest_count_expected && (
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Users className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{event.guest_count_expected} expected guests</span>
                  </div>
                )}
              </div>
              {event.dress_code && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-slate-500">Dress code: </span>
                  <span className="text-xs font-medium text-gray-700">
                    {event.dress_code}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Event"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Event Title *"
                placeholder="Amina & Ahmed Wedding"
                error={errors.title?.message}
                {...register("title")}
              />
            </div>
            <Input
              label="Event Date *"
              type="date"
              error={errors.event_date?.message}
              {...register("event_date")}
            />
            <Input
              label="RSVP Deadline"
              type="date"
              error={errors.rsvp_deadline?.message}
              {...register("rsvp_deadline")}
            />
            <Input
              label="Venue Name"
              placeholder="Golden Tulip Hotel"
              {...register("venue_name")}
            />
            <Input
              label="Expected Guests"
              type="number"
              placeholder="300"
              {...register("guest_count_expected")}
            />
            <div className="sm:col-span-2">
              <Input
                label="Venue Address"
                placeholder="Ohio Street, Dar es Salaam"
                {...register("venue_address")}
              />
            </div>
            <Input
              label="Dress Code"
              placeholder="Black Tie / Peach & Gold"
              {...register("dress_code")}
            />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Card Theme
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gold-400 focus:border-transparent outline-none"
                {...register("card_theme")}
              >
                <option value="">Select theme</option>
                <option value="elegant">Elegant</option>
                <option value="modern">Modern</option>
                <option value="traditional">Traditional</option>
                <option value="colorful">Colorful</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="send_save_the_date"
                defaultChecked
                {...register("send_save_the_date")}
                className="h-4 w-4 rounded border-gray-300 text-gold-600 focus:ring-gold-500"
              />
              <label htmlFor="send_save_the_date" className="text-sm font-medium text-gray-700">
                Send Save the Date
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              isLoading={createMutation.isPending}
              className="flex-1"
            >
              Create Event
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
