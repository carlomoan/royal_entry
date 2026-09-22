// frontend/src/pages/public/invitations/[code].tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar, MapPin, Clock, Users, CheckCircle, XCircle, QrCode,
  Heart, Sparkles, AlertCircle, Loader2, Download, Share2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Badge } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function PublicInvitationPage() {
  const router = useRouter();
  const code = router.query.code as string;
  const qc = useQueryClient();
  const [plusOneName, setPlusOneName] = useState("");
  const [showPlusOne, setShowPlusOne] = useState(false);

  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ["public-invitation", code],
    queryFn: async () => (await api.get(`/public/invitations/${code}`)).data.data,
    enabled: !!code,
    retry: false,
  });

  const rsvpMutation = useMutation({
    mutationFn: (payload: { status: string; plus_one_name?: string }) =>
      api.post(`/public/invitations/${code}/rsvp`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-invitation", code] });
      toast.success("RSVP recorded successfully!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to record RSVP"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950">
        <Loader2 className="h-12 w-12 animate-spin text-gold-500" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-rose-500" />
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Invalid Invitation</h1>
          <p className="text-slate-600">
            This invitation link is invalid or has expired. Please contact the event organizer.
          </p>
        </div>
      </div>
    );
  }

  const { event, guest, invitation: inv } = invitation;
  const qrUrl = `${api.defaults.baseURL}/events/${event.id}/invitations/${inv.id}/qr`;
  const hasRsvp = guest.rsvp_status && guest.rsvp_status !== "pending";

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header Card */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-white shadow-2xl">
          {/* Event Header */}
          <div className="bg-gradient-to-br from-navy-950 to-navy-800 p-8 text-white">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold-400" />
              <span className="text-sm font-semibold uppercase tracking-wider text-gold-400">
                You're Invited
              </span>
            </div>
            <h1 className="mb-2 text-3xl font-bold">{event.title}</h1>
            <p className="text-slate-300">
              {event.main_characters && `Featuring: ${event.main_characters}`}
            </p>
          </div>

          {/* Guest Info */}
          <div className="border-b border-slate-100 bg-gold-50 p-6">
            <p className="text-sm font-medium uppercase tracking-wide text-gold-700">
              Dear
            </p>
            <h2 className="mt-1 text-2xl font-bold text-navy-950">{guest.full_name}</h2>
            {guest.guest_category && guest.guest_category !== "Regular" && (
              <Badge label={guest.guest_category} variant="gold" className="mt-2" />
            )}
          </div>

          {/* Event Details */}
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100">
                <Calendar className="h-5 w-5 text-navy-950" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Date</p>
                <p className="font-semibold text-slate-900">{formatDate(event.event_date)}</p>
              </div>
            </div>

            {event.event_time && (
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100">
                  <Clock className="h-5 w-5 text-navy-950" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Time</p>
                  <p className="font-semibold text-slate-900">{formatTime(event.event_time)}</p>
                </div>
              </div>
            )}

            {event.venue_name && (
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100">
                  <MapPin className="h-5 w-5 text-navy-950" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Venue</p>
                  <p className="font-semibold text-slate-900">{event.venue_name}</p>
                  {event.venue_address && (
                    <p className="text-sm text-slate-600">{event.venue_address}</p>
                  )}
                </div>
              </div>
            )}

            {event.dress_code && (
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100">
                  <Users className="h-5 w-5 text-navy-950" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Dress Code</p>
                  <p className="font-semibold text-slate-900">{event.dress_code}</p>
                </div>
              </div>
            )}
          </div>

          {/* QR Code Section */}
          <div className="border-t border-slate-100 bg-slate-50 p-6 text-center">
            <p className="mb-4 text-sm font-medium text-slate-600">
              Your Unique Entry Pass
            </p>
            <div className="mx-auto mb-4 inline-block rounded-2xl bg-white p-4 shadow-lg">
              <img
                src={qrUrl}
                alt="Your QR Code"
                className="h-48 w-48"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/qr-placeholder.svg";
                }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Show this QR code at the entrance for quick check-in
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = qrUrl;
                  link.download = `invitation-${guest.full_name}.png`;
                  link.click();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Save QR
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.share({
                    title: event.title,
                    text: `I'm invited to ${event.title}!`,
                    url: window.location.href,
                  }).catch(() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied to clipboard");
                  });
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* RSVP Section */}
        {!hasRsvp ? (
          <div className="rounded-3xl bg-white p-8 shadow-2xl">
            <h3 className="mb-2 text-center text-2xl font-bold text-slate-900">
              Will you attend?
            </h3>
            <p className="mb-6 text-center text-sm text-slate-600">
              Please confirm your attendance by {formatDate(event.rsvp_deadline || event.event_date)}
            </p>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => rsvpMutation.mutate({
                  status: "confirmed",
                  plus_one_name: showPlusOne ? plusOneName : undefined,
                })}
                isLoading={rsvpMutation.isPending}
                className="h-14"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Yes, I'll be there
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => rsvpMutation.mutate({ status: "declined" })}
                isLoading={rsvpMutation.isPending}
                className="h-14"
              >
                <XCircle className="mr-2 h-5 w-5" />
                Can't make it
              </Button>
            </div>

            {guest.plus_one_allowed && (
              <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={showPlusOne}
                    onChange={(e) => setShowPlusOne(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded accent-gold-500"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Bringing a plus-one?</p>
                    <p className="text-xs text-slate-600">
                      You may bring one guest. Please provide their name.
                    </p>
                    {showPlusOne && (
                      <input
                        type="text"
                        value={plusOneName}
                        onChange={(e) => setPlusOneName(e.target.value)}
                        placeholder="Plus-one guest name"
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                      />
                    )}
                  </div>
                </label>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-8 text-center shadow-2xl">
            {guest.rsvp_status === "confirmed" ? (
              <>
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
                <h3 className="mb-2 text-2xl font-bold text-slate-900">
                  We'll see you there!
                </h3>
                <p className="text-slate-600">
                  Your attendance has been confirmed. We look forward to celebrating with you.
                </p>
                {guest.plus_one_name && (
                  <p className="mt-4 text-sm text-slate-600">
                    <Heart className="mr-1 inline h-4 w-4 text-rose-500" />
                    Plus-one: <strong>{guest.plus_one_name}</strong>
                  </p>
                )}
              </>
            ) : (
              <>
                <XCircle className="mx-auto mb-4 h-16 w-16 text-rose-500" />
                <h3 className="mb-2 text-2xl font-bold text-slate-900">
                  We'll miss you!
                </h3>
                <p className="text-slate-600">
                  Thank you for letting us know. We hope to see you at future events.
                </p>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-400">
            Powered by <span className="font-semibold text-gold-400">RoyalEntry</span>
          </p>
        </div>
      </div>
    </div>
  );
}
