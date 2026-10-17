"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  Download, Share2, ArrowLeft, Loader2, AlertCircle,
  Calendar, MapPin, Clock, User, CreditCard, CheckCircle2,
  QrCode, Smartphone, Mail
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Card, Badge } from "@/components/ui";
import { RoyalCard } from "@/components/cards/RoyalCard";

export default function GuestCardPage() {
  const router = useRouter();
  const { id: eventId, guestId } = router.query;
  const [downloading, setDownloading] = useState(false);

  // Fetch guest data
  const { data: guest, isLoading: guestLoading, error: guestError } = useQuery({
    queryKey: ["guest", eventId, guestId],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}/guests/${guestId}`);
      return res.data.data;
    },
    enabled: !!eventId && !!guestId,
  });

  // Fetch event data
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}`);
      return res.data.data;
    },
    enabled: !!eventId,
  });

  // Fetch invitations
  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}/invitations`);
      return res.data.data ?? [];
    },
    enabled: !!eventId,
  });

  // Fetch pledges
  const { data: pledges = [] } = useQuery({
    queryKey: ["pledges", eventId],
    queryFn: async () => {
      const res = await api.get(`/events/${eventId}/michango?per_page=500`);
      return res.data.data ?? [];
    },
    enabled: !!eventId,
  });

  // Fetch active card template
  const { data: templates = [] } = useQuery({
    queryKey: ["card-templates"],
    queryFn: async () => {
      const res = await api.get("/cards/templates");
      return res.data.data ?? [];
    },
  });

  const activeTemplate = templates.find((t: any) => t.is_active);
  const invitation = invitations.find((i: any) => i.guest_id === guestId);
  const pledge = pledges.find((p: any) => p.guest_id === guestId);

  const isLoading = guestLoading || eventLoading;
  const hasError = guestError || (!guest && !isLoading) || (!event && !isLoading);

  // Build QR payload
  const qrPayload = invitation?.scan_payload ||
    invitation?.short_link ? `${window.location.origin}/g/${invitation.short_link}` :
    `${window.location.origin}/events/${eventId}/guest/${guestId}`;

  // Download handler
  const handleDownload = async () => {
    if (!eventId || !guestId) return;
    setDownloading(true);
    try {
      const res = await api.post("/cards/render", {
        event_id: eventId,
        guest_id: guestId,
      }, { responseType: "blob" });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invitation_${guest?.full_name?.replace(/\s+/g, "_") || "guest"}.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Card downloaded successfully!");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // Share handler
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/events/${eventId}/guest/${guestId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${guest?.full_name}'s Invitation`,
          text: `You're invited to ${event?.title}!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      }
    } catch {
      toast.error("Failed to share");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-gold-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading invitation card...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Card Not Found</h2>
          <p className="text-slate-600 mb-6">
            The requested invitation card could not be loaded. Please check the URL and try again.
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </Card>
      </div>
    );
  }

  if (!guest || !event) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">No data available</p>
      </div>
    );
  }

  const paymentStatus = pledge?.payment_status || "no_pledge";
  const isPaid = paymentStatus === "paid";
  const pledgedAmount = pledge?.pledged_amount || 0;
  const amountPaid = pledge?.amount_paid || 0;
  const remainingAmount = pledgedAmount - amountPaid;

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "TBD";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gold-50/30">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Event
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
            <Button size="sm" onClick={handleDownload} isLoading={downloading}>
              <Download className="h-4 w-4 mr-1" /> Download PNG
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Card Preview */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Your Invitation Card</h2>
                <Badge label={isPaid ? "Paid" : paymentStatus} variant={isPaid ? "green" : "amber"} />
              </div>

              {activeTemplate ? (
                <RoyalCard
                  template={activeTemplate}
                  qrPayload={qrPayload}
                  width={600}
                />
              ) : (
                <div className="aspect-[3/4] bg-slate-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="h-16 w-16 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No card template configured</p>
                    <p className="text-xs text-slate-400 mt-1">Please set up a template in the Card Studio</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Guest & Event Details */}
          <div className="space-y-4">
            {/* Guest Info */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-gold-600" />
                <h3 className="font-semibold text-slate-900">Guest Details</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Name</p>
                  <p className="text-sm font-semibold text-slate-900">{guest.full_name}</p>
                </div>
                {guest.guest_category && guest.guest_category !== "Regular" && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Category</p>
                    <Badge label={guest.guest_category} variant="gold" />
                  </div>
                )}
                {guest.table_number && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Table</p>
                    <p className="text-sm font-semibold text-slate-900">Table {guest.table_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Contact</p>
                  <div className="space-y-1">
                    {guest.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>{guest.phone}</span>
                      </div>
                    )}
                    {guest.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{guest.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Event Info */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-gold-600" />
                <h3 className="font-semibold text-slate-900">Event Details</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Event</p>
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Date</p>
                  <p className="text-sm text-slate-700">{eventDate}</p>
                </div>
                {event.event_time && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Time</p>
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{event.event_time}</span>
                    </div>
                  </div>
                )}
                {event.venue_name && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Venue</p>
                    <div className="flex items-start gap-1 text-sm text-slate-700">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{event.venue_name}</p>
                        {event.venue_address && (
                          <p className="text-xs text-slate-500">{event.venue_address}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Payment Status */}
            {pledge && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-gold-600" />
                  <h3 className="font-semibold text-slate-900">Payment Status</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Status</span>
                    <Badge
                      label={isPaid ? "Paid in Full" : paymentStatus}
                      variant={isPaid ? "green" : paymentStatus === "partial" ? "amber" : "slate"}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Pledged</p>
                    <p className="text-sm font-semibold text-slate-900">
                      TZS {pledgedAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Paid</p>
                    <p className="text-sm font-semibold text-green-600">
                      TZS {amountPaid.toLocaleString()}
                    </p>
                  </div>
                  {!isPaid && remainingAmount > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Remaining</p>
                      <p className="text-sm font-semibold text-rose-600">
                        TZS {remainingAmount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            Generated by RoyalEntry • {new Date().toLocaleDateString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Present this card at the event entrance for check-in
          </p>
        </div>
      </div>
    </div>
  );
}