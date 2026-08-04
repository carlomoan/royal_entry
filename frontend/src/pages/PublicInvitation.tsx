// src/pages/PublicInvitation.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { publicInvitationsApi } from "@/api/publicInvitations";
import InvitationCardPreview from "@/components/invitations/InvitationCardPreview";
import Button from "@/components/ui/Button";
import { formatDate, formatDateTime } from "@/utils/format";

export default function PublicInvitation() {
  const { code } = useParams<{ code: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-invitation", code],
    queryFn: () => publicInvitationsApi.get(code!),
    enabled: !!code,
  });

  const rsvpMutation = useMutation({
    mutationFn: (response: "confirmed" | "declined") =>
      publicInvitationsApi.submitRsvp(code!, response),
    onSuccess: (updated) => {
      qc.setQueryData(["public-invitation", code], updated);
      toast.success("Your RSVP has been saved");
    },
    onError: (mutationError: unknown) => {
      const msg =
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to save RSVP right now";
      toast.error(msg);
    },
  });

  const whatsappLink = useMemo(() => {
    if (!data) return "#";
    const message = `You are invited to ${data.event.title}. View your card here: ${data.invitation.public_url}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [data]);

  const smsLink = useMemo(() => {
    if (!data) return "#";
    const message = `RoyalEntry invite for ${data.event.title}: ${data.invitation.public_url}`;
    return `sms:?body=${encodeURIComponent(message)}`;
  }, [data]);

  const copyText = async (label: string, value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-gold-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
        <div className="max-w-xl rounded-[32px] border border-white/70 bg-white/95 p-8 text-center shadow-2xl shadow-slate-200/60">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Invitation not available
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {String(
              error instanceof Error
                ? error.message
                : "This invitation link is invalid or has expired.",
            )}
          </p>
        </div>
      </div>
    );
  }

  const rsvpTone =
    data.rsvp.response === "confirmed"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : data.rsvp.response === "declined"
      ? "text-rose-700 bg-rose-50 border-rose-200"
      : "text-slate-700 bg-slate-50 border-slate-200";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,214,94,0.25),_transparent_36%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200/50 backdrop-blur-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-700">
                Digital guest card
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                Welcome, {data.guest.full_name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                This is your personal RoyalEntry invitation card. Show the QR
                code at the door or share your secure link with the host if you
                need assistance.
              </p>
            </div>
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${rsvpTone}`}
            >
              RSVP: {data.rsvp.response}
              {data.rsvp.responded_at
                ? ` · ${formatDateTime(data.rsvp.responded_at)}`
                : ""}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <InvitationCardPreview
            theme={data.event.card_theme ?? "modern"}
            event={data.event}
            guest={data.guest}
            invitation={data.invitation}
            subtitle="RoyalEntry guest pass"
          />
          <div className="space-y-6">
            <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-200/50">
              <h2 className="text-lg font-black text-slate-900">RSVP now</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Help the organiser plan seating, catering, and reception by
                confirming or declining your attendance.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button
                  size="lg"
                  isLoading={rsvpMutation.isPending}
                  onClick={() => rsvpMutation.mutate("confirmed")}
                >
                  <CheckCircle2 className="h-5 w-5" /> I will attend
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  isLoading={rsvpMutation.isPending}
                  onClick={() => rsvpMutation.mutate("declined")}
                >
                  <XCircle className="h-5 w-5" /> I cannot attend
                </Button>
              </div>
              {data.event.rsvp_deadline && (
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  RSVP deadline: {formatDate(data.event.rsvp_deadline)}
                </p>
              )}
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-200/50">
              <h2 className="text-lg font-black text-slate-900">
                Event details
              </h2>
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <DetailRow
                  icon={CalendarDays}
                  label="Date"
                  value={formatDate(data.event.event_date)}
                />
                <DetailRow
                  icon={Clock3}
                  label="Time"
                  value={data.event.event_time ?? "To be announced"}
                />
                <DetailRow
                  icon={MapPin}
                  label="Venue"
                  value={data.event.venue_name ?? "Venue to be announced"}
                />
                <DetailRow
                  icon={ShieldCheck}
                  label="Dress code"
                  value={data.event.dress_code ?? "As communicated by the host"}
                />
                <DetailRow
                  icon={Smartphone}
                  label="Table / category"
                  value={`${data.guest.table_number ? `Table ${data.guest.table_number}` : "Table pending"} · ${data.guest.guest_category ?? "Regular"}`}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-200/50">
              <h2 className="text-lg font-black text-slate-900">
                Share & access
              </h2>
              <div className="mt-5 space-y-4">
                <ActionRow
                  label="Guest card link"
                  value={data.invitation.public_url}
                  onCopy={() =>
                    copyText("Guest link", data.invitation.public_url)
                  }
                />
                <ActionRow
                  label="Door scan URL"
                  value={data.invitation.scan_url}
                  onCopy={() => copyText("Scan URL", data.invitation.scan_url)}
                />
                <ActionRow
                  label="Manual short code"
                  value={data.invitation.scan_payload}
                  onCopy={() =>
                    copyText("Short code", data.invitation.scan_payload)
                  }
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <a href={whatsappLink} target="_blank" rel="noreferrer">
                  <Button variant="ghost" className="w-full">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
                <a href={smsLink}>
                  <Button variant="ghost" className="w-full">
                    <Smartphone className="h-4 w-4" /> SMS
                  </Button>
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Invitation: ${data.event.title}`)}&body=${encodeURIComponent(data.invitation.public_url)}`}
                >
                  <Button variant="ghost" className="w-full">
                    <Mail className="h-4 w-4" /> Email
                  </Button>
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="rounded-xl bg-gold-50 p-2 text-gold-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </p>
        <p className="mt-1 font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function ActionRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </p>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
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
