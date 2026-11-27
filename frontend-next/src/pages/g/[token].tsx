"use client";
// Public check-in card (/g/<short_link>) — the link printed on invitations.
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import {
  AlertCircle, CalendarDays, CarFront, Check, Clock, Copy, Download, FileDown,
  Image as ImageIcon, Link2, Loader2, Lock, MapPin, Printer, QrCode,
  Share2, Sparkles, Users,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Badge, Button } from "@/components/ui";
import { cn, formatDate, formatTime } from "@/lib/utils";

type ParkingVariant = { class_name?: string | null; instructions?: string | null };

type CheckInData = {
  invitation: {
    id: string;
    short_link: string;
    status: string;
    scan_count?: number;
    invitation_sent_at?: string | null;
    last_scanned_at?: string | null;
    created_at?: string;
    public_url?: string;
    scan_url?: string;
    scan_payload?: string;
  };
  guest: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string | null;
    table_number?: string | null;
    guest_category?: string | null;
    plus_one_allowed?: boolean;
    contact_method?: string;
    seat_number?: string | null;
    party_size?: number | null;
    card_issued_at?: string | null;
  };
  event: {
    id: string;
    title: string;
    description?: string | null;
    event_date: string;
    event_time?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
    dress_code?: string | null;
    card_theme?: string | null;
    rsvp_deadline?: string | null;
    entry_start_time?: string | null;
    entry_end_time?: string | null;
    parking_instructions?: string | null;
    parking_variants?: ParkingVariant[] | null;
  };
  rsvp?: { response?: string | null; responded_at?: string | null } | null;
};

type ArrivalMessage = {
  id: string;
  title: string;
  body: string;
  media_url?: string | null;
  contribution_block?: string | null;
};
type ArrivalData = { guest_name?: string; messages?: ArrivalMessage[] } | null;

// Statuses that explicitly mean the guest's card has not been issued yet.
// "sent" / "viewed" / "scanned" are normal invitation states and still show the QR.
const NOT_ISSUED_STATUSES = new Set([
  "pending", "draft", "not_issued", "unissued", "revoked", "withdrawn",
  "cancelled", "canceled", "inactive",
]);

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-navy-50">
        <Icon className="h-4 w-4 text-navy-800" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="break-words text-sm font-semibold text-slate-900">{children}</div>
      </div>
    </div>
  );
}

export default function CheckInCardPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : undefined;
  const [qrFailed, setQrFailed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["check-in-card", token],
    queryFn: async (): Promise<CheckInData> =>
      (await api.get(`/public/invitations/${encodeURIComponent(token!)}`)).data.data,
    enabled: !!token,
    retry: false,
  });

  const eventId = data?.event?.id;
  // Arrival messages are gated by the backend (403 until the guest has arrived).
  const { data: arrival } = useQuery({
    queryKey: ["arrival-message", eventId, token],
    queryFn: async (): Promise<ArrivalData> => {
      try {
        const res = await api.post(`/public/w/${encodeURIComponent(String(eventId))}/view`, {
          code: token,
        });
        return (res.data?.data ?? null) as ArrivalData;
      } catch {
        // 403 means "not arrived yet"; any other failure is also non-fatal here.
        return null;
      }
    },
    enabled: !!eventId && !!token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-6">
        <Loader2 className="h-10 w-10 animate-spin text-gold-500" />
        <p className="text-sm font-medium text-slate-300">Loading your check-in card…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <AlertCircle className="mx-auto mb-4 h-14 w-14 text-rose-500" />
          <h1 className="text-2xl font-bold text-slate-900">Invalid check-in link</h1>
          <p className="mt-2 break-words text-sm text-slate-600">
            This link is invalid or has expired. Please contact the event organizer for a new card.
          </p>
        </div>
      </div>
    );
  }

  const { invitation, guest, event } = data;
  const qrUrl = `${api.defaults.baseURL}/public/invitations/${invitation.short_link}/qr`;
  const guestSlug =
    guest.full_name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "guest";

  // Backwards compatibility: when the backend does not send card_issued_at at
  // all, show the QR. Only an explicit null + a "not issued" status, or a
  // future issue date, locks the card.
  const hasIssueField = Object.prototype.hasOwnProperty.call(guest, "card_issued_at");
  const issuedRaw = hasIssueField ? guest.card_issued_at : undefined;
  const issuedAt = typeof issuedRaw === "string" ? new Date(issuedRaw) : null;
  const issuedInFuture =
    !!issuedAt && !Number.isNaN(issuedAt.getTime()) && issuedAt.getTime() > Date.now();
  const statusNotIssued =
    issuedRaw === null &&
    NOT_ISSUED_STATUSES.has(String(invitation.status ?? "").trim().toLowerCase());
  const cardLocked = issuedInFuture || statusNotIssued;
  const availableAfter =
    issuedInFuture && issuedAt
      ? formatDate(issuedAt)
      : formatDate(event.rsvp_deadline ?? event.event_date);

  const guestClass = String(guest.guest_category ?? "").trim().toLowerCase();
  const myParking = guestClass
    ? (event.parking_variants ?? []).find(
        (v) => String(v?.class_name ?? "").trim().toLowerCase() === guestClass
      )
    : undefined;
  const timeLabel = event.event_time
    ? formatTime(event.event_time) === "—"
      ? event.event_time
      : formatTime(event.event_time)
    : null;
  const messages = arrival?.messages ?? [];

  const copy = async (value: string, successMessage: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      toast.success(successMessage);
    } catch {
      toast.error("Could not copy. Please copy the value manually.");
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: event.title, text: `Check-in card for ${event.title}`, url });
        return;
      } catch {
        // Cancelled or unsupported — fall back to copying the link.
      }
    }
    await copy(url, "Link copied to clipboard");
  };

  const triggerDownload = (href: string, filename: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadQr = async () => {
    try {
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, `checkin-qr-${guestSlug}.png`);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      toast.error("Could not download the QR code. Please try again.");
    }
  };

  const downloadCardPdf = async () => {
    const url = `${window.location.origin}/api/v1/public/invitations/${encodeURIComponent(invitation.short_link)}/card/pdf`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, `checkin-card-${guestSlug}.pdf`);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // If the browser blocks the blob download, let the guest save it manually.
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener,noreferrer";
      link.click();
      toast.error("Could not download automatically — the card opened in a new tab.");
    }
  };

  const copyCheckInLink = async () => {
    await copy(window.location.href, "Check-in link copied");
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2 text-gold-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">RoyalEntry</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button size="sm" variant="outline" onClick={downloadQr} aria-label="Download QR code">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download QR</span>
              <span className="sm:hidden">QR</span>
            </Button>
            <Button size="sm" variant="outline" onClick={downloadCardPdf} aria-label="Download card as PDF">
              <FileDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download card (PDF)</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button size="sm" variant="outline" onClick={copyCheckInLink} aria-label="Copy check-in link">
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? "Copied!" : "Copy check-in link"}</span>
              <span className="sm:hidden">{copiedLink ? "Copied!" : "Copy link"}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={share}>
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl print:rounded-none print:shadow-none">
          {/* Navy / gold header */}
          <div className="bg-gradient-to-br from-navy-950 to-navy-800 px-6 py-7 text-white">
            <div className="flex items-center gap-2 text-gold-400">
              <QrCode className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">Check-in card</span>
            </div>
            <h1 className="mt-3 break-words text-2xl font-black leading-tight sm:text-3xl">
              {event.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-gold-400" /> {formatDate(event.event_date)}
              </span>
              {timeLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gold-400" /> {timeLabel}
                </span>
              )}
            </div>
          </div>

          {/* Guest identity */}
          <div className="border-b border-gold-200 bg-gold-50 px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-700">Guest</p>
            <h2 className="mt-1 break-words text-2xl font-bold text-navy-950">{guest.full_name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {guest.guest_category && <Badge label={guest.guest_category} variant="gold" />}
              {guest.table_number && (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-navy-900 ring-1 ring-gold-200">
                  Table {guest.table_number}
                </span>
              )}
              {guest.seat_number && (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-navy-900 ring-1 ring-gold-200">
                  Seat {guest.seat_number}
                </span>
              )}
              {guest.party_size != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-navy-900 ring-1 ring-gold-200">
                  <Users className="h-3 w-3" /> {guest.party_size} {guest.party_size === 1 ? "person" : "people"}
                </span>
              )}
            </div>
          </div>

          {/* Event details */}
          <div className="space-y-4 px-6 py-6">
            <DetailRow icon={CalendarDays} label="Date">
              {formatDate(event.event_date)}
            </DetailRow>
            {timeLabel && (
              <DetailRow icon={Clock} label="Time">
                {timeLabel}
              </DetailRow>
            )}
            {(event.venue_name || event.venue_address) && (
              <DetailRow icon={MapPin} label="Venue">
                {event.venue_name}
                {event.venue_address && (
                  <span className="block break-words text-sm font-normal text-slate-600">
                    {event.venue_address}
                  </span>
                )}
              </DetailRow>
            )}
            {event.dress_code && (
              <DetailRow icon={Users} label="Dress code">
                {event.dress_code}
              </DetailRow>
            )}
          </div>

          {/* Entry code */}
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Your entry code
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="print:hidden"
                onClick={() => copy(token, "Entry code copied")}
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-3 py-3">
              <Check className="h-4 w-4 flex-shrink-0 text-gold-600" />
              <span className="min-w-0 flex-1 break-all font-mono text-base font-bold tracking-wide text-navy-950 sm:text-lg">
                {token}
              </span>
            </div>
          </div>

          {/* QR / locked state */}
          {cardLocked ? (
            <div className="border-t border-amber-200 bg-amber-50 px-6 py-8 text-center">
              <Lock className="mx-auto mb-3 h-10 w-10 text-amber-600" />
              <h3 className="break-words text-lg font-bold text-amber-900">
                Check-in card becomes available after {availableAfter}
              </h3>
              <p className="mx-auto mt-2 max-w-sm break-words text-sm text-amber-800">
                Your QR code will appear here once your card has been issued. Please check back later.
              </p>
            </div>
          ) : (
            <div className="border-t border-slate-100 bg-white px-6 py-7 text-center">
              <p className="mb-4 text-sm font-semibold text-slate-700">Show this QR at the gate</p>
              <div
                className={cn(
                  "mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3 shadow-lg ring-1 ring-slate-200",
                  qrFailed && "border border-dashed border-slate-300 ring-0"
                )}
              >
                {qrFailed ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <QrCode className="h-16 w-16" />
                    <span className="text-xs">QR code unavailable</span>
                  </div>
                ) : (
                  <img
                    src={qrUrl}
                    alt="Check-in QR code"
                    className="h-48 w-48 object-contain"
                    onError={() => setQrFailed(true)}
                  />
                )}
              </div>
              <p className="mt-3 break-words text-xs text-slate-500">
                Present this code at the entrance for a fast check-in.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 print:hidden"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = qrUrl;
                  link.download = `check-in-${token}.png`;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                }}
              >
                <Download className="h-3.5 w-3.5" /> Save QR
              </Button>
            </div>
          )}

          {/* Parking */}
          {(event.parking_instructions || myParking) && (
            <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-6 py-6">
              <div className="flex items-center gap-2">
                <CarFront className="h-4 w-4 text-gold-600" />
                <h3 className="text-sm font-bold text-navy-950">Parking</h3>
              </div>
              {event.parking_instructions && (
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                  {event.parking_instructions}
                </p>
              )}
              {myParking?.instructions && (
                <div className="rounded-xl border border-gold-300 bg-gold-100/70 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gold-800">
                    <CarFront className="h-3.5 w-3.5" /> Parking for your class
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                    {myParking.instructions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Arrival messages — only present after check-in */}
          {messages.length > 0 && (
            <div className="space-y-4 border-t border-gold-200 bg-gold-50 px-6 py-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-gold-700" />
                <h3 className="text-base font-bold text-navy-950">
                  Welcome{arrival?.guest_name ? `, ${arrival.guest_name}` : ""}
                </h3>
              </div>
              {messages.map((message) => (
                <div key={message.id} className="rounded-xl border border-gold-200 bg-white/80 p-4">
                  <h4 className="break-words text-sm font-bold text-navy-950">{message.title}</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                    {message.body}
                  </p>
                  {message.media_url && (
                    <a
                      href={message.media_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-700 hover:underline"
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> View attachment
                    </a>
                  )}
                  {message.contribution_block && (
                    <div className="mt-3 rounded-lg border border-gold-200 bg-gold-50 p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gold-800">
                        <Link2 className="h-3.5 w-3.5" /> Contribution
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                        {message.contribution_block}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400">
            Powered by <span className="font-semibold text-gold-600">RoyalEntry</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 print:hidden">
          Keep this card handy — you will need it at the gate.
        </p>
      </div>
    </div>
  );
}
