// ==============================================================================
// FILE: src/pages/CardStudio.tsx
// ==============================================================================
import { useEffect, useMemo, useState } from "react"; // CHANGE: Added useEffect
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Mail,
  MessageCircle,
  Palette,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wand2,
} from "lucide-react";
import toast from "react-hot-toast";
import { eventsApi } from "@/api/events";
import { guestsApi } from "@/api/guests";
import { invitationsApi } from "@/api/invitations";
import InvitationCardPreview from "@/components/invitations/InvitationCardPreview";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDate } from "@/utils/format";
import {
  cardTemplates,
  filterTemplates,
  getTemplate,
  EVENT_TYPES,
  CARD_TIERS,
  type EventType,
  type CardTier,
} from "@/data/cardTemplates";

const tierBadgeColor: Record<CardTier, string> = {
  standard: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  premium: "bg-gold-100 text-gold-800 ring-1 ring-gold-300",
  vip: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
  vvip: "bg-gradient-to-r from-gold-400 to-amber-600 text-white ring-1 ring-gold-500",
  compact: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
};

export default function CardStudio() {
  const { id: eventId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => eventsApi.get(eventId!),
    enabled: !!eventId,
  });

  const [selectedTheme, setSelectedTheme] = useState(
    event?.card_theme ?? "modern_midnight",
  );
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | "all">(
    "all",
  );
  const [tierFilter, setTierFilter] = useState<CardTier | "all">("all");
  const [selectedGuestId, setSelectedGuestId] = useState<string>("");

  // Sync selected theme once the event loads.
  const eventTheme = event?.card_theme;
  useEffect(() => {
    if (eventTheme) {
      setSelectedTheme(eventTheme);
    }
  }, [eventTheme]);
  const [themeSynced, setThemeSynced] = useState(false);
  if (!themeSynced && eventTheme) {
    setSelectedTheme(eventTheme);
    setThemeSynced(true);
  }

  const { data: guestsData } = useQuery({
    queryKey: ["guests-card-studio", eventId],
    queryFn: () => guestsApi.list(eventId!, 1, 100),
    enabled: !!eventId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: () => invitationsApi.list(eventId!),
    enabled: !!eventId,
  });

  const guests = guestsData?.data ?? [];

  const sampleGuest = useMemo(
    () =>
      guests.find((guest) => guest.id === selectedGuestId) ?? guests[0] ?? null,
    [guests, selectedGuestId],
  );

  const sampleInvitation = useMemo(() => {
    if (!sampleGuest) return invitations[0] ?? null;
    return (
      invitations.find(
        (invitation) => invitation.guest_id === sampleGuest.id,
      ) ?? null
    );
  }, [invitations, sampleGuest]);

  const saveThemeMutation = useMutation({
    mutationFn: () => eventsApi.update(eventId!, { card_theme: selectedTheme }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["event-summary", eventId] });
      toast.success("Card theme saved");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to save card theme";
      toast.error(message);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => invitationsApi.generate(eventId!, false),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["invitations", eventId] });
      toast.success(
        result.generated > 0
          ? `Generated ${result.generated} invitation links`
          : "Invitations already existed for the current guest list",
      );
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate invitations";
      toast.error(message);
    },
  });

  const activeTemplate = getTemplate(selectedTheme);
  const filteredTemplates = filterTemplates(eventTypeFilter, tierFilter);

  const shareMessage = useMemo(() => {
    if (!event || !sampleInvitation) return "";
    const guestName = sampleGuest?.full_name ?? "Guest";
    return `Dear ${guestName}, you are invited to ${event.title} on ${formatDate(event.event_date)}. View your digital invitation card here: ${sampleInvitation.public_url}`;
  }, [event, sampleGuest, sampleInvitation]);

  const copyValue = async (label: string, value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to event
          </Link>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Invitation Card Studio
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Choose a card by event type and guest class, generate secure entry
            QR codes, and prepare the exact links you will send via WhatsApp,
            SMS, or email.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={`/events/${eventId}/customize`}>
            <Button variant="ghost">
              <Wand2 className="h-4 w-4" /> Open customizer
            </Button>
          </Link>
          <Button
            variant="ghost"
            isLoading={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            <QrCode className="h-4 w-4" /> Generate invitations
          </Button>
          <Button
            isLoading={saveThemeMutation.isPending}
            onClick={() => saveThemeMutation.mutate()}
          >
            <Palette className="h-4 w-4" /> Save selected theme
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.2fr]">
        {/* ── Design controls ─────────────────────────────────────────────── */}
        <Card
          title="Design controls"
          className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
        >
          <div className="space-y-5">
            {/* Filters */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <Filter className="h-4 w-4" /> Filter templates
              </div>
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-400">
                    Event type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      active={eventTypeFilter === "all"}
                      onClick={() => setEventTypeFilter("all")}
                      label="All"
                    />
                    {EVENT_TYPES.filter((t) => t.key !== "generic").map((t) => (
                      <FilterChip
                        key={t.key}
                        active={eventTypeFilter === t.key}
                        onClick={() => setEventTypeFilter(t.key)}
                        label={t.label}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-400">
                    Guest class
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      active={tierFilter === "all"}
                      onClick={() => setTierFilter("all")}
                      label="All"
                    />
                    {CARD_TIERS.map((t) => (
                      <FilterChip
                        key={t.key}
                        active={tierFilter === t.key}
                        onClick={() => setTierFilter(t.key)}
                        label={t.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Template gallery */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                  Templates
                </p>
                <span className="text-xs text-slate-400">
                  {filteredTemplates.length} of {cardTemplates.length}
                </span>
              </div>
              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {filteredTemplates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
                    No templates match these filters. Try a different event type
                    or class.
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => setSelectedTheme(template.key)}
                      className={`w-full rounded-[22px] border p-4 text-left transition ${
                        selectedTheme === template.key
                          ? "border-gold-300 bg-gold-50/60 shadow-md"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tierBadgeColor[template.tier]}`}
                            >
                              {template.tier}
                            </span>
                            <p className="truncate font-bold text-slate-900">
                              {template.name}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {template.description}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {template.eventTypes
                              .filter((et) => et !== "generic")
                              .map((et) => (
                                <span
                                  key={et}
                                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-500"
                                >
                                  {et}
                                </span>
                              ))}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-center gap-2">
                          <div
                            className={`h-12 w-12 rounded-xl bg-gradient-to-br ${template.accent} shadow-inner`}
                          />
                          {selectedTheme === template.key && (
                            <CheckCircle2 className="h-5 w-5 text-gold-600" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Guest selector */}
            <div>
              <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-slate-500">
                Preview guest
              </label>
              <select
                value={sampleGuest?.id ?? ""}
                onChange={(e) => setSelectedGuestId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
              >
                {guests.length === 0 ? (
                  <option value="">
                    Add guests to preview personalized cards
                  </option>
                ) : (
                  guests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.full_name}{" "}
                      {guest.table_number
                        ? `· Table ${guest.table_number}`
                        : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Feature grid */}
            <div className="grid gap-3 md:grid-cols-2">
              {[
                {
                  icon: MessageCircle,
                  label: "WhatsApp ready",
                  text: "Copy a personalized guest-card link and send instantly.",
                },
                {
                  icon: Mail,
                  label: "Email friendly",
                  text: "Share the same invitation page by email with no extra app needed.",
                },
                {
                  icon: Smartphone,
                  label: "SMS short code",
                  text: "Door staff can type the secure invitation short code manually.",
                },
                {
                  icon: ShieldCheck,
                  label: "Door QR payload",
                  text: "The QR contains the scan URL that the scanner page can consume directly.",
                },
              ].map(({ icon: Icon, label, text }) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Icon className="h-4 w-4 text-gold-600" /> {label}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{text}</p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-white p-5">
              <p className="text-sm font-semibold text-slate-900">Send flow</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Step 1: filter by event type and class. Step 2: pick a template.
                Step 3: generate invitations. Step 4: copy the guest card link
                or open the live guest page. Step 5: send reminders through
                Broadcast using the same public link.
              </p>
            </div>
          </div>
        </Card>

        {/* ── Live card preview ───────────────────────────────────────────── */}
        <Card
          title="Live card preview"
          className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
        >
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tierBadgeColor[activeTemplate.tier]}`}
            >
              {activeTemplate.tier}
            </span>
            <span className="font-semibold text-slate-700">
              {activeTemplate.name}
            </span>
            <span className="capitalize text-slate-400">
              · {activeTemplate.layout} layout
            </span>
          </div>

          <InvitationCardPreview
            theme={selectedTheme}
            event={{
              title: event?.title ?? "Your event title",
              event_date: event?.event_date ?? new Date().toISOString(),
              event_time: event?.event_time,
              venue_name: event?.venue_name,
              venue_address: event?.venue_address,
              dress_code: event?.dress_code,
              rsvp_deadline: event?.rsvp_deadline,
            }}
            guest={{
              full_name: sampleGuest?.full_name ?? "Guest name preview",
              table_number: sampleGuest?.table_number,
              guest_category: sampleGuest?.guest_category,
            }}
            invitation={{
              short_link: sampleInvitation?.short_link,
              scan_url: sampleInvitation?.scan_url,
            }}
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <ActionPanel
              title="Guest card link"
              value={
                sampleInvitation?.public_url ??
                "Generate invitations to create public guest links"
              }
              onCopy={() =>
                copyValue("Guest card link", sampleInvitation?.public_url)
              }
            />
            <ActionPanel
              title="Door scan URL"
              value={
                sampleInvitation?.scan_url ??
                "Generate invitations to create scanner-ready QR URLs"
              }
              onCopy={() =>
                copyValue("Door scan URL", sampleInvitation?.scan_url)
              }
            />
            <ActionPanel
              title="Manual short code"
              value={
                sampleInvitation?.scan_payload ??
                sampleInvitation?.short_link ??
                "Generate invitations to create a short code"
              }
              onCopy={() =>
                copyValue(
                  "Short code",
                  sampleInvitation?.scan_payload ??
                    sampleInvitation?.short_link,
                )
              }
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              "3.1 Personalized digital card",
              "3.2 Secure QR / one-guest code",
              "3.4 SMS-friendly short access link",
              "3.5 Live organiser dashboard sync",
              "3.7 Save-the-date + invitation sequence",
              "3.11 Automatic countdown reminders",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-semibold text-slate-700"
              >
                <Sparkles className="mb-2 h-4 w-4 text-gold-600" />
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Share + payload ──────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card
          title="Share actions"
          className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
        >
          {!sampleInvitation ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Generate invitations first to unlock share links, public card
              preview, and QR payload copying.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Suggested message
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {shareMessage}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="ghost">
                    <MessageCircle className="h-4 w-4" /> Send via WhatsApp
                  </Button>
                </a>
                <a href={`sms:?body=${encodeURIComponent(shareMessage)}`}>
                  <Button variant="ghost">
                    <Smartphone className="h-4 w-4" /> Send via SMS
                  </Button>
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Invitation: ${event?.title ?? "RoyalEntry event"}`)}&body=${encodeURIComponent(shareMessage)}`}
                >
                  <Button variant="ghost">
                    <Mail className="h-4 w-4" /> Send via email
                  </Button>
                </a>
                <a
                  href={sampleInvitation.public_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="secondary">
                    <ExternalLink className="h-4 w-4" /> Open live guest page
                  </Button>
                </a>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Working payload map"
          className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
        >
          <div className="space-y-4 text-sm">
            <PayloadRow
              label="Public invitation route"
              value={
                sampleInvitation?.public_url ??
                `/invite/${sampleInvitation?.short_link ?? "inv-..."}`
              }
            />
            <PayloadRow
              label="QR encoded value"
              value={
                sampleInvitation?.scan_url ??
                "http://localhost:5173/events/<event-id>/scanner?code=inv-..."
              }
            />
            <PayloadRow
              label="Manual fallback code"
              value={
                sampleInvitation?.scan_payload ??
                sampleInvitation?.short_link ??
                "inv-..."
              }
            />
            <PayloadRow
              label="Theme being edited"
              value={`${activeTemplate.name} (${selectedTheme})`}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-navy-800 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

// ── Action panel ──────────────────────────────────────────────────────────────

function ActionPanel({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:text-gold-800"
        >
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
      </div>
      <p className="mt-2 break-all text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

function PayloadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-all font-medium text-slate-800">{value}</p>
    </div>
  );
}
