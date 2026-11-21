"use client";
// Per-event settings: mode, card issuing, gate OTP, pledges and parking instructions.
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, AlertTriangle, Info, ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";

type SettingsForm = {
  event_mode: string;
  checkin_policy: string;
  min_percent: string;
  card_issue_at: string;
  otp_mode: string;
  otp_channels: string[];
  pledge_deadline_at: string;
  min_pledge_per_person: string;
  min_pledge_plus_one: string;
  payment_instructions: string;
  parking_instructions: string;
};

const EMPTY_FORM: SettingsForm = {
  event_mode: "family",
  checkin_policy: "family_approval",
  min_percent: "",
  card_issue_at: "",
  otp_mode: "all",
  otp_channels: ["sms", "whatsapp", "email"],
  pledge_deadline_at: "",
  min_pledge_per_person: "",
  min_pledge_plus_one: "",
  payment_instructions: "",
  parking_instructions: "",
};

const CHANNELS = ["sms", "whatsapp", "email"] as const;

type ParkingVariant = {
  id: string;
  event_id: string;
  class_name: string;
  instructions: string;
  created_at: string;
};

const backendError = (e: any, fallback: string) =>
  e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? fallback;

/** ISO timestamp -> value accepted by a datetime-local input (local time). */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventSettingsEditor({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [variantClass, setVariantClass] = useState("");
  const [variantInstructions, setVariantInstructions] = useState("");

  const { data: parkingVariants = [], isLoading: variantsLoading } = useQuery<ParkingVariant[]>({
    queryKey: ["parking-variants", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/parking-variants`)).data.data ?? [],
    enabled: !!eventId && eventId !== "undefined",
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["event-summary", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/summary`)).data.data,
    enabled: !!eventId && eventId !== "undefined",
  });

  useEffect(() => {
    const event = summary?.event;
    if (!event) return;
    setForm({
      event_mode: event.event_mode ?? "family",
      checkin_policy: event.checkin_policy ?? "family_approval",
      min_percent: event.min_percent != null ? String(event.min_percent) : "",
      card_issue_at: toLocalInput(event.card_issue_at),
      otp_mode: event.otp_mode ?? "all",
      otp_channels: Array.isArray(event.otp_channels) ? event.otp_channels : [],
      pledge_deadline_at: toLocalInput(event.pledge_deadline_at),
      min_pledge_per_person: event.min_pledge_per_person != null ? String(event.min_pledge_per_person) : "",
      min_pledge_plus_one: event.min_pledge_plus_one != null ? String(event.min_pledge_plus_one) : "",
      payment_instructions: event.payment_instructions ?? "",
      parking_instructions: event.parking_instructions ?? "",
    });
  }, [summary?.event]);

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleChannel = (channel: string) =>
    setForm((prev) => ({
      ...prev,
      otp_channels: prev.otp_channels.includes(channel)
        ? prev.otp_channels.filter((c) => c !== channel)
        : CHANNELS.filter((c) => c === channel || prev.otp_channels.includes(c)),
    }));

  const moveChannel = (channel: string, direction: -1 | 1) =>
    setForm((prev) => {
      const channels = [...prev.otp_channels];
      const from = channels.indexOf(channel);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= channels.length) return prev;
      [channels[from], channels[to]] = [channels[to], channels[from]];
      return { ...prev, otp_channels: channels };
    });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put(`/events/${eventId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-summary", eventId] });
      toast.success("Event settings saved");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed to save event settings"),
  });

  const addVariantMutation = useMutation({
    mutationFn: (payload: { class_name: string; instructions: string }) =>
      api.post(`/events/${eventId}/parking-variants`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parking-variants", eventId] });
      setVariantClass("");
      setVariantInstructions("");
      toast.success("Parking variant added");
    },
    onError: (e: any) => toast.error(backendError(e, "Failed to add parking variant")),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${eventId}/parking-variants/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parking-variants", eventId] });
      toast.success("Parking variant removed");
    },
    onError: (e: any) => toast.error(backendError(e, "Failed to delete parking variant")),
  });

  const submitVariant = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!variantClass.trim()) {
      toast.error("Enter a class name");
      return;
    }
    addVariantMutation.mutate({
      class_name: variantClass.trim(),
      instructions: variantInstructions.trim(),
    });
  };

  const handleSave = () => {
    saveMutation.mutate({
      event_mode: form.event_mode,
      checkin_policy: form.checkin_policy,
      min_percent: Number(form.min_percent || 0),
      card_issue_at: form.card_issue_at ? new Date(form.card_issue_at).toISOString() : null,
      otp_mode: form.otp_mode,
      otp_channels: form.otp_channels,
      pledge_deadline_at: form.pledge_deadline_at ? new Date(form.pledge_deadline_at).toISOString() : null,
      min_pledge_per_person: form.min_pledge_per_person === "" ? null : Number(form.min_pledge_per_person),
      min_pledge_plus_one: form.min_pledge_plus_one === "" ? null : Number(form.min_pledge_plus_one),
      payment_instructions: form.payment_instructions || null,
      parking_instructions: form.parking_instructions || null,
    });
  };

  if (isLoading) return <Card title="Event settings"><p className="text-sm text-slate-500">Loading settings…</p></Card>;

  return (
    <Card title="Event settings">
      <div className="space-y-6">
        {/* Event mode */}
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-bold text-navy-950">Event mode</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Family events use guest approvals and pledges; corporate events use booked packages and company tables.
            </p>
          </div>
          <Select
            label="Mode"
            value={form.event_mode}
            onChange={(e) => set("event_mode", e.target.value)}
            className="max-w-sm"
          >
            <option value="family">Family</option>
            <option value="corporate">Corporate</option>
          </Select>
        </section>

        {/* Card issuing */}
        <section className="space-y-3 border-t border-slate-100 pt-5">
          <div>
            <h4 className="text-sm font-bold text-navy-950">Card issuing</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Controls when a guest&apos;s check-in card becomes valid at the gate.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Check-in policy"
              value={form.checkin_policy}
              onChange={(e) => set("checkin_policy", e.target.value)}
            >
              <option value="family_approval">Family approval</option>
              <option value="full_payment">Full payment</option>
              <option value="min_percent">Minimum percent paid</option>
            </Select>
            {form.checkin_policy === "min_percent" && (
              <Input
                label="Minimum percent (%)"
                type="number"
                min={0}
                max={100}
                value={form.min_percent}
                onChange={(e) => set("min_percent", e.target.value)}
                placeholder="e.g. 50"
              />
            )}
          </div>
          <Input
            label="Cards valid from (optional)"
            type="datetime-local"
            value={form.card_issue_at}
            onChange={(e) => set("card_issue_at", e.target.value)}
            className="max-w-sm"
            hint="Leave empty to issue cards as soon as the policy is met."
          />
        </section>

        {/* Gate OTP */}
        <section className="space-y-3 border-t border-slate-100 pt-5">
          <div>
            <h4 className="text-sm font-bold text-navy-950">Gate OTP</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Guests prove their identity with a one-time code at check-in.
            </p>
          </div>
          <Select
            label="OTP mode"
            value={form.otp_mode}
            onChange={(e) => set("otp_mode", e.target.value)}
            className="max-w-sm"
          >
            <option value="all">All guests</option>
            <option value="feature_phone_only">Feature phones only</option>
            <option value="off">Off</option>
          </Select>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">
              Delivery channels (in preference order)
            </p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => {
                const checked = form.otp_channels.includes(channel);
                const index = form.otp_channels.indexOf(channel);
                return (
                  <div
                    key={channel}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked ? "border-gold-400 bg-gold-50 text-navy-950" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-2 capitalize">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChannel(channel)}
                        className="h-4 w-4 rounded accent-gold-500"
                      />
                      {channel}
                    </label>
                    {checked && (
                      <span className="flex items-center gap-0.5 border-l border-slate-200 pl-2">
                        <button
                          type="button"
                          aria-label={`Move ${channel} up`}
                          disabled={index === 0}
                          onClick={() => moveChannel(channel, -1)}
                          className="rounded p-0.5 text-slate-500 hover:bg-white disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${channel} down`}
                          disabled={index === form.otp_channels.length - 1}
                          onClick={() => moveChannel(channel, 1)}
                          className="rounded p-0.5 text-slate-500 hover:bg-white disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {form.otp_mode === "off" && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                With OTP off, anyone holding a forwarded shared card can enter — guest identity is not verified.
              </p>
            )}
            <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
              Feature-phone guests always receive their code by SMS, regardless of the channel order above.
            </p>
          </div>
        </section>

        {/* Family pledges */}
        <section className="space-y-3 border-t border-slate-100 pt-5">
          <div>
            <h4 className="text-sm font-bold text-navy-950">Family pledges</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Minimum contributions and payment details shown to guests before check-in.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Minimum per person (TZS)"
              type="number"
              min={0}
              value={form.min_pledge_per_person}
              onChange={(e) => set("min_pledge_per_person", e.target.value)}
              placeholder="No minimum"
            />
            <Input
              label="Minimum plus-one (TZS)"
              type="number"
              min={0}
              value={form.min_pledge_plus_one}
              onChange={(e) => set("min_pledge_plus_one", e.target.value)}
              placeholder="No minimum"
            />
          </div>
          <Input
            label="Pledge deadline (optional)"
            type="datetime-local"
            value={form.pledge_deadline_at}
            onChange={(e) => set("pledge_deadline_at", e.target.value)}
            className="max-w-sm"
          />
          <Textarea
            label="Payment instructions"
            rows={3}
            value={form.payment_instructions}
            onChange={(e) => set("payment_instructions", e.target.value)}
            placeholder="e.g. Lipa kwa M-Pesa: 123456 · Reference: guest name"
          />
        </section>

        {/* Parking */}
        <section className="space-y-3 border-t border-slate-100 pt-5">
          <div>
            <h4 className="text-sm font-bold text-navy-950">Parking</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Appears on invitation and check-in pages, and in SMS reminders to guests.
            </p>
          </div>
          <Textarea
            label="Parking instructions"
            rows={3}
            value={form.parking_instructions}
            onChange={(e) => set("parking_instructions", e.target.value)}
            placeholder="e.g. Park at the main gate; show your card to the attendant."
          />

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-bold text-navy-950">Parking by guest class</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Shown on invitation/check-in pages for guests of this class; feature-phone guests get a short SMS version.
              </p>
            </div>
            <form
              onSubmit={submitVariant}
              className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end"
            >
              <Input
                label="Class name"
                value={variantClass}
                onChange={(e) => setVariantClass(e.target.value)}
                placeholder="e.g. VIP"
              />
              <Textarea
                label="Instructions"
                rows={2}
                value={variantInstructions}
                onChange={(e) => setVariantInstructions(e.target.value)}
                placeholder="e.g. Use the north entrance and quote your class name."
              />
              <Button type="submit" size="sm" isLoading={addVariantMutation.isPending}>
                <Plus className="h-4 w-4" /> Add variant
              </Button>
            </form>
            {variantsLoading ? (
              <p className="text-xs text-slate-500">Loading variants…</p>
            ) : parkingVariants.length === 0 ? (
              <p className="text-xs text-slate-400">No class-specific parking instructions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {parkingVariants.map((variant) => (
                  <li key={variant.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-950">{variant.class_name}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">
                        {variant.instructions || <span className="text-slate-400">No instructions</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete parking instructions for "${variant.class_name}"?`)) {
                          deleteVariantMutation.mutate(variant.id);
                        }
                      }}
                      className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                      title="Delete variant"
                    ><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex justify-end border-t border-slate-100 pt-5">
          <Button onClick={handleSave} isLoading={saveMutation.isPending} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" /> Save settings
          </Button>
        </div>
      </div>
    </Card>
  );
}
