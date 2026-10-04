"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Download, QrCode, Mail, Smartphone, Send, XCircle, Printer, Share2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Button, Card, Badge, Modal } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { RoyalCardTheme, normalizeTheme } from "@/types/royal-card";
import { RoyalCardPage } from "@/components/cards/RoyalCard";
import { buildCardData } from "@/lib/cardData";

// ============================================================================
// Guest Card page — renders the event's RoyalCardTheme with real DB data.
// Exports via the server render route (/api/render-card) with an html2canvas
// fallback. All rendering goes through the SHARED <RoyalCardPage /> renderer.
// ============================================================================
export default function GuestCardPage() {
  const router = useRouter();
  const { id: eventId, guestId } = router.query;
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [cardWidth, setCardWidth] = useState(900);

  useEffect(() => {
    const onResize = () => setCardWidth(Math.min(900, window.innerWidth - 64));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------------------------------------------------------- data
  const { data: guest, isLoading: guestLoading, error: guestError } = useQuery({
    queryKey: ["guest-card", eventId, guestId],
    queryFn: async () => (await api.get(`/events/${eventId}/guests/${guestId}`)).data.data,
    enabled: !!eventId && !!guestId,
  });

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}`)).data.data,
    enabled: !!eventId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/invitations`)).data.data ?? [],
    enabled: !!eventId,
  });

  const { data: pledges = [] } = useQuery({
    queryKey: ["pledges", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/michango?per_page=500`)).data.data ?? [],
    enabled: !!eventId,
  });

  // The event's chosen RoyalCardTheme (v1 configs are migrated on load).
  const { data: theme } = useQuery<RoyalCardTheme | null>({
    queryKey: ["card-theme", event?.card_template_id],
    queryFn: async () => {
      const res = await api.get(`/cards/templates/${event.card_template_id}`);
      const t = res.data.data;
      return normalizeTheme({ ...(t.theme_config ?? {}), id: t.id, name: t.name });
    },
    enabled: !!event?.card_template_id,
  });

  useEffect(() => { if (guestError) toast.error("Failed to load guest information"); }, [guestError]);

  const invitation = invitations.find((inv: any) => inv.guest_id === guestId);
  const pledge = pledges.find((p: any) => p.guest_id === guestId);
  const qrPayload = invitation?.scan_url ?? invitation?.scan_payload;
  const data = buildCardData(event, guest, invitation, qrPayload);

  // ---------------------------------------------------------- export
  const handleDownload = async (format: "png" | "pdf") => {
    // Primary: server-side render — fonts & QR are guaranteed correct.
    if (invitation?.id) {
      try {
        const res = await fetch(
          `/api/render-card?eventId=${eventId}&guestId=${guestId}&invitationId=${invitation.id}&format=${format}`
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `invitation_${(guest?.full_name ?? "guest").replace(/\s+/g, "_")}.${format}`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success(`Downloaded as ${format.toUpperCase()}`);
          return;
        }
      } catch { /* fall through to client-side */ }
    }
    // Fallback: html2canvas (requires the theme to be loaded client-side)
    if (!sheetRef.current || !theme) return toast.error("Nothing to export");
    try {
      const pages = sheetRef.current.querySelectorAll<HTMLElement>(".royal-card");
      if (format === "pdf") {
        const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [theme.size.width, theme.size.height] });
        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: null });
          if (i > 0) pdf.addPage([theme.size.width, theme.size.height]);
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, theme.size.width, theme.size.height);
        }
        pdf.save(`invitation_${(guest?.full_name ?? "guest").replace(/\s+/g, "_")}.pdf`);
      } else {
        // PNG: all pages side-by-side on one sheet (print-shop friendly)
        const first = pages[0];
        const canvas = await html2canvas(sheetRef.current, {
          scale: 2, useCORS: true, backgroundColor: "#ffffff",
          width: (theme.size.width + 32) * pages.length - 32,
        });
        const link = document.createElement("a");
        link.download = `invitation_${(guest?.full_name ?? "guest").replace(/\s+/g, "_")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        void first;
      }
      toast.success("Downloaded");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleShare = async () => {
    if (!invitation?.public_url) return toast.error("No invitation link available");
    try { await navigator.clipboard.writeText(invitation.public_url); toast.success("Card link copied"); }
    catch { toast.error("Failed to copy link"); }
  };

  const handleSendCard = async (channel: "whatsapp" | "sms" | "email") => {
    if (!invitation) return toast.error("Generate an invitation link first");
    try {
      await api.post(`/events/${eventId}/invitations/send`, { guest_ids: [guestId], channel });
      toast.success(`Card sent via ${channel.toUpperCase()}`);
      setSendModalOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? `Failed to send via ${channel}`);
    }
  };

  const isLoading = guestLoading || eventLoading;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-50 to-gold-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-800 mx-auto mb-4" />
          <p className="text-slate-600">Loading guest card…</p>
        </div>
      </div>
    );
  }

  if (!guest || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-50 to-gold-50">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Guest Not Found</h2>
          <Button onClick={() => router.back()} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Go Back</Button>
        </div>
      </div>
    );
  }

  const paymentStatus = pledge?.payment_status ?? "no_pledge";
  const remainingAmount = (pledge?.pledged_amount ?? 0) - (pledge?.amount_paid ?? 0);

  // ---------------------------------------------------------- render
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-white to-gold-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Button onClick={() => router.back()} variant="ghost" className="text-navy-800">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Event
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleShare} variant="outline" size="sm"><Share2 className="h-4 w-4 mr-2" /> Share</Button>
            <Button onClick={() => window.print()} variant="outline" size="sm"><Printer className="h-4 w-4 mr-2" /> Print</Button>
            <Button onClick={() => handleDownload("png")} variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> PNG</Button>
            <Button onClick={() => handleDownload("pdf")} variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> PDF</Button>
            <Button onClick={() => setSendModalOpen(true)} variant="primary" size="sm"><Send className="h-4 w-4 mr-2" /> Send Card</Button>
          </div>
        </div>

        {/* Rendered card(s) — shared renderer, real data */}
        {theme ? (
          <div ref={sheetRef} className="flex flex-wrap justify-center gap-8 py-4">
            {theme.pages.map((page) => (
              <div key={page.id}>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 text-center">{page.name}</p>
                <div className="shadow-2xl">
                  <RoyalCardPage page={page} data={data} width={cardWidth} height={Math.round((cardWidth * theme.size.height) / theme.size.width)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card title="No card theme selected" className="max-w-md mx-auto">
            <p className="text-sm text-slate-500 mb-4">
              This event does not have a card template assigned. Ask your administrator to pick one in the event settings.
            </p>
            <div className="flex justify-center">
              <QrCode className="h-16 w-16 text-slate-300" />
            </div>
          </Card>
        )}

        {/* Guest summary */}
        <Card title="Guest Details" className="mt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-slate-500">Phone</p><p className="font-semibold">{guest.phone}</p></div>
            <div><p className="text-slate-500">Email</p><p className="font-semibold">{guest.email || "—"}</p></div>
            <div><p className="text-slate-500">Device</p><p className="font-semibold">{guest.device_type === "feature_phone" ? "Feature Phone" : "Smartphone"}</p></div>
            <div><p className="text-slate-500">Pledge</p><Badge label={paymentStatus === "paid" ? "Paid in full" : paymentStatus} variant={paymentStatus === "paid" ? "green" : paymentStatus === "no_pledge" ? "slate" : "amber"} /></div>
          </div>
          {pledge && paymentStatus !== "paid" && (
            <p className="mt-3 text-xs font-medium text-amber-700">
              Outstanding pledge balance: TZS {remainingAmount.toLocaleString()}
            </p>
          )}
        </Card>

        {/* Instructions */}
        <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-navy-800 mb-2">Card Instructions</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Present this card at the event entrance for check-in</li>
            <li>• On the check-in side, scan the QR code with your camera app</li>
            {guest.device_type === "feature_phone" && <li>• Feature phone guests: show the manual check-in code instead</li>}
            {pledge && paymentStatus !== "paid" && <li className="text-amber-700">• Please complete your pledge payment of TZS {remainingAmount.toLocaleString()}</li>}
          </ul>
        </div>

        {/* Send modal */}
        <Modal isOpen={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Send Card to Guest" size="md">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">{guest.full_name}</p>
              <p className="text-slate-600">{guest.phone}{guest.email && ` • ${guest.email}`}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {guest.device_type === "feature_phone" ? (
                <Button variant="outline" onClick={() => handleSendCard("sms")} className="w-full">
                  <Smartphone className="h-4 w-4 mr-2" /> Send SMS
                </Button>
              ) : (
                <Button variant="outline" onClick={() => handleSendCard("whatsapp")} className="w-full">
                  <Send className="h-4 w-4 mr-2" /> Send WhatsApp
                </Button>
              )}
              {guest.email && (
                <Button variant="outline" onClick={() => handleSendCard("email")} className="w-full">
                  <Mail className="h-4 w-4 mr-2" /> Send Email
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 text-center">
              The card is rendered server-side from the event theme and sent as an image attachment.
            </p>
          </div>
        </Modal>
      </div>
    </div>
  );
}
