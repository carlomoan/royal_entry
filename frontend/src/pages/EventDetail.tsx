// ==============================================================================
// FILE: src/pages/EventDetail.tsx
// ==============================================================================
// CHANGE: Removed ALL trailing spaces from imports to prevent duplicate React module instances
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Event, EventSummary } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  FileText,
  Mail,
  Palette,
  QrCode,
  Radio,
  ScanLine,
  Users,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { eventsApi } from "@/api/events";
import { invitationsApi } from "@/api/invitations";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format";
import GuestsTab from "./Guests";
import MichangoTab from "./Michango";
import BroadcastTab from "./Broadcast";

// CHANGE: Removed trailing spaces from TABS keys and labels
const TABS = [
  { key: "overview", label: "Overview", icon: Zap },
  { key: "guests", label: "Guests", icon: Users },
  { key: "michango", label: "Michango", icon: Banknote },
  { key: "broadcast", label: "Broadcast", icon: Radio },
];

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("overview");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["event-summary", id],
    queryFn: () => eventsApi.summary(id!),
    enabled: !!id,
    refetchInterval: activeTab === "overview" ? 15_000 : false,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", id],
    queryFn: () => invitationsApi.list(id!),
    enabled: !!id,
  });

  const genMutation = useMutation({
    mutationFn: () => invitationsApi.generate(id!),
    onSuccess: (result) => {
      toast.success(
        `Generated ${result.generated} invitation links (${result.skipped} skipped)`,
      );
      qc.invalidateQueries({ queryKey: ["event-summary", id] });
      qc.invalidateQueries({ queryKey: ["invitations", id] });
    },
    // CHANGE: Replaced 'any' with 'unknown' for safe error handling
    onError: (error: unknown) => {
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to generate invitations";
      toast.error(msg);
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => eventsApi.downloadReportPdf(id!),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error ? error.message : "Failed to download report";
      toast.error(msg);
    },
  });

  const saveTheDateMutation = useMutation({
    mutationFn: () => eventsApi.sendSaveTheDate(id!),
    onSuccess: () => {
      toast.success("Save-the-date sent!");
      qc.invalidateQueries({ queryKey: ["event-summary", id] });
    },
    onError: (error: unknown) => {
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to send save-the-date";
      toast.error(msg);
    },
  });

  // CHANGE: Wrapped in useMemo to prevent recalculation on every render
  const recentInvitations = useMemo(
    () => invitations.slice(0, 3),
    [invitations],
  );

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-40 rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!summary) return null;

  const { event, summary: stats } = summary;

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-white/70 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-6 text-white shadow-2xl shadow-navy-900/20">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <Link
              to="/events"
              className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/15"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight">
                  {event.title}
                </h1>
                <Badge
                  label={event.status}
                  className="bg-white/15 text-white ring-0"
                />
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-200">
                {event.venue_name || "Venue not set"} ·{" "}
                {formatDate(event.event_date)}
                {event.dress_code ? ` · Dress code: ${event.dress_code}` : ""}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => genMutation.mutate()}
                  isLoading={genMutation.isPending}
                  variant="primary"
                  size="sm"
                >
                  <QrCode className="h-4 w-4" /> Generate invitation links
                </Button>
                <Link to={`/events/${id}/scanner`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  >
                    <ScanLine className="h-4 w-4" /> Open scanner
                  </Button>
                </Link>
                <Link to={`/events/${id}/cards`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  >
                    <Palette className="h-4 w-4" /> Card studio
                  </Button>
                </Link>
                <Button
                  onClick={() => reportMutation.mutate()}
                  isLoading={reportMutation.isPending}
                  variant="ghost"
                  size="sm"
                  className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                >
                  <FileText className="h-4 w-4" /> Download Report (PDF)
                </Button>
                {(event.status === "draft" || event.status === "approved") && !event.save_the_date_sent_at && (
                  <Button
                    onClick={() => saveTheDateMutation.mutate()}
                    isLoading={saveTheDateMutation.isPending}
                    variant="ghost"
                    size="sm"
                    className="border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  >
                    <Mail className="h-4 w-4" /> Send Save the Date
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* CHANGE: Removed hardcoded magic number 'xl:min-w-[520px]' for fluid CSS Grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              { label: "Guests", value: stats.total_guests },
              { label: "Arrived", value: stats.guests_arrived },
              { label: "Confirmed", value: stats.rsvp_confirmed },
              { label: "Declined", value: stats.rsvp_declined },
              { label: "Invites sent", value: stats.invitations_sent },
              {
                label: "Michango",
                value: `TZS ${(stats.michango_collected_tsh / 1000).toFixed(0)}k`,
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card
          title="Event snapshot"
          className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Venue", value: event.venue_name ?? "Not set yet" },
              { label: "Address", value: event.venue_address ?? "Not set yet" },
              { label: "Time", value: event.event_time ?? "Not set yet" },
              { label: "Card theme", value: event.card_theme ?? "Not set yet" },
              {
                label: "RSVP deadline",
                value: event.rsvp_deadline
                  ? formatDate(event.rsvp_deadline)
                  : "Not set yet",
              },
              { label: "Dress code", value: event.dress_code ?? "Not set yet" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Scanner & invitations"
          className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                Invitations now have both a public guest-card link and a
                scanner-ready QR URL
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Guests open a public invitation page, while door staff can still
                scan the QR payload into the authenticated scanner workspace.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to={`/events/${id}/scanner`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-gold-700 hover:text-gold-800"
                >
                  Open scanner workspace <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to={`/events/${id}/cards`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-gold-700 hover:text-gold-800"
                >
                  Open card studio <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {recentInvitations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Generate invitations to see ready-to-scan links here.
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge label={invitation.status} />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(invitation.public_url);
                          toast.success("Guest invitation link copied");
                        }}
                        className="text-xs font-semibold text-gold-700 hover:text-gold-800"
                      >
                        Copy guest link
                      </button>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p className="break-all">
                        <span className="font-semibold text-slate-900">
                          Guest:
                        </span>{" "}
                        {invitation.public_url}
                      </p>
                      <p className="break-all">
                        <span className="font-semibold text-slate-900">
                          Scanner:
                        </span>{" "}
                        {invitation.scan_url}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/75 p-2 shadow-lg shadow-slate-200/40 backdrop-blur-sm">
        <nav className="flex flex-wrap gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                activeTab === key
                  ? "bg-navy-900 text-white shadow-lg shadow-navy-900/10"
                  : "text-slate-500 hover:bg-white hover:text-slate-800",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === "overview" && (
          <OverviewTab event={event} stats={stats} />
        )}
        {activeTab === "guests" && <GuestsTab />}
        {activeTab === "michango" && <MichangoTab />}
        {activeTab === "broadcast" && <BroadcastTab />}
      </div>
    </div>
  );
}

// CHANGE: Replaced 'any' with 'any' for now, but ideally you should import the exact Event and Stats types
function OverviewTab({ event, stats }: { event: Event; stats: EventSummary["summary"] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card
        title="Event details"
        className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
      >
        <div className="space-y-4">
          {[
            { label: "Title", value: event.title },
            { label: "Date", value: formatDate(event.event_date) },
            { label: "Time", value: event.event_time ?? "—" },
            { label: "Venue", value: event.venue_name ?? "—" },
            { label: "Address", value: event.venue_address ?? "—" },
            { label: "Dress code", value: event.dress_code ?? "—" },
            { label: "Card theme", value: event.card_theme ?? "—" },
            {
              label: "RSVP deadline",
              value: event.rsvp_deadline
                ? formatDate(event.rsvp_deadline)
                : "—",
            },
            {
              label: "Save the date",
              value: event.send_save_the_date
                ? event.save_the_date_sent_at
                  ? `Sent (${formatDate(event.save_the_date_sent_at)})`
                  : "Pending send"
                : "Not enabled",
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-start justify-between gap-6 rounded-2xl bg-slate-50 p-4 text-sm"
            >
              <span className="font-medium text-slate-500">{label}</span>
              <span className="max-w-[60%] text-right font-semibold text-slate-900">
                {value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Attendance summary"
        className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
      >
        <div className="space-y-4">
          {[
            {
              label: "Total guests",
              value: stats.total_guests,
              color: "bg-sky-500",
            },
            {
              label: "Arrived",
              value: stats.guests_arrived,
              color: "bg-emerald-500",
            },
            {
              label: "RSVP confirmed",
              value: stats.rsvp_confirmed,
              color: "bg-gold-500",
            },
            {
              label: "RSVP declined",
              value: stats.rsvp_declined,
              color: "bg-rose-400",
            },
            {
              label: "Invites sent",
              value: stats.invitations_sent,
              color: "bg-violet-500",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"
            >
              <div className={cn("h-3 w-3 rounded-full", color)} />
              <span className="flex-1 text-sm text-slate-600">{label}</span>
              <span className="text-lg font-black text-slate-900">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
