"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft, ArrowUpRight, Banknote, Radio, ScanLine, Users, Zap, QrCode, FileText, Mail,
  UserPlus, Upload, Download, FileUp, Plus, Trash2, CheckSquare, Square, MoreVertical,
  MessageSquare, Smartphone, Copy, ExternalLink, AlertCircle, Send, Bell, CheckCircle, Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, StatCard, Modal, Input, Select } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin", platform_admin: "Platform Admin", system_admin: "System Admin",
  account_admin: "Account Admin", event_manager: "Event Manager", event_accountant: "Event Accountant",
  secretary: "Secretary", scanner_attendant: "Scanner Attendant", viewer: "Viewer",
};

export default function EventDetailPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["event-summary", id],
    queryFn: async () => (await api.get(`/events/${id}/summary`)).data.data,
  });

  const genMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/invitations/generate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-summary", id] }); toast.success("Invitation links generated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const sendInvitationsMutation = useMutation({
    mutationFn: (payload: { guest_ids?: string[]; channel?: string }) =>
      api.post(`/events/${id}/invitations/send`, payload),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["event-summary", id] });
      toast.success(`Invitations sent to ${r.data.data.sent} guests`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed"),
  });

  const saveTheDateMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/send-save-the-date`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-summary", id] }); toast.success("Save-the-date sent!"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/submit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-summary", id] }); toast.success("Event submitted for approval"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-summary", id] }); toast.success("Event completed & thank-yous sent"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const downloadReport = () => {
    api.get(`/events/${id}/report/pdf`, { responseType: "blob" }).then((r: any) => {
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Report downloaded");
    }).catch(() => toast.error("Failed to download report"));
  };

  if (isLoading || !summary) return <p className="text-sm text-slate-500">Loading…</p>;

  const { event, summary: stats } = summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-navy-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{event.title}</h1>
                <Badge label={event.status} className="bg-white/15 text-white" />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {event.venue_name || "Venue not set"} · {formatDate(event.event_date)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => genMutation.mutate()} isLoading={genMutation.isPending} variant="outline" size="sm">
              <QrCode className="h-4 w-4" /> Generate links
            </Button>
            <Button onClick={() => sendInvitationsMutation.mutate({})} isLoading={sendInvitationsMutation.isPending} variant="outline" size="sm">
              <Mail className="h-4 w-4" /> Send Invitations
            </Button>
            <Button onClick={downloadReport} variant="outline" size="sm">
              <FileText className="h-4 w-4" /> Report (PDF)
            </Button>
            {event.status === "draft" && (
              <Button onClick={() => submitMutation.mutate()} isLoading={submitMutation.isPending} variant="outline" size="sm">
                <ArrowUpRight className="h-4 w-4" /> Submit for approval
              </Button>
            )}
            {(event.status === "draft" || event.status === "approved") && !event.save_the_date_sent_at && (
              <Button onClick={() => saveTheDateMutation.mutate()} isLoading={saveTheDateMutation.isPending} variant="outline" size="sm">
                <Mail className="h-4 w-4" /> Save the Date
              </Button>
            )}
            {event.status === "active" && (
              <Button onClick={() => completeMutation.mutate()} isLoading={completeMutation.isPending} variant="primary" size="sm">
                Complete Event
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniStat label="Guests" value={stats.total_guests} />
          <MiniStat label="Arrived" value={stats.guests_arrived} />
          <MiniStat label="Confirmed" value={stats.rsvp_confirmed} />
          <MiniStat label="Declined" value={stats.rsvp_declined} />
          <MiniStat label="Invites sent" value={stats.invitations_sent} />
          <MiniStat label="Michango" value={`TZS ${(stats.michango_collected_tsh / 1000).toFixed(0)}k`} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {[
          { key: "overview", label: "Overview", icon: Zap },
          { key: "guests", label: "Guests", icon: Users },
          { key: "michango", label: "Michango", icon: Banknote },
          { key: "broadcast", label: "Broadcast", icon: Radio },
          { key: "staff", label: "Staff", icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === key ? "bg-navy-950 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
        <button
          onClick={() => router.push(`/events/${id}/scanner`)}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gold-700 transition hover:bg-gold-50"
        >
          <ScanLine className="h-4 w-4" /> Scanner
        </button>
      </div>

      {/* Content */}
      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Event Details">
            <div className="space-y-3">
              {[
                { label: "Title", value: event.title },
                { label: "Date", value: formatDate(event.event_date) },
                { label: "Time", value: event.event_time ?? "—" },
                { label: "Venue", value: event.venue_name ?? "—" },
                { label: "Address", value: event.venue_address ?? "—" },
                { label: "Dress code", value: event.dress_code ?? "—" },
                { label: "Card theme", value: event.card_theme ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-6 rounded-lg bg-slate-50 p-4 text-sm">
                  <span className="font-medium text-slate-500">{label}</span>
                  <span className="max-w-[60%] text-right font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Attendance Summary">
            <div className="space-y-3">
              {[
                { label: "Total guests", value: stats.total_guests, color: "bg-sky-500" },
                { label: "Arrived", value: stats.guests_arrived, color: "bg-emerald-500" },
                { label: "RSVP confirmed", value: stats.rsvp_confirmed, color: "bg-gold-500" },
                { label: "RSVP declined", value: stats.rsvp_declined, color: "bg-rose-400" },
                { label: "Invites sent", value: stats.invitations_sent, color: "bg-violet-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
                  <div className={`h-3 w-3 rounded-full ${color}`} />
                  <span className="flex-1 text-sm text-slate-600">{label}</span>
                  <span className="text-lg font-black text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "guests" && <GuestsTab eventId={id} />}
      {activeTab === "staff" && <EventStaffTab eventId={id} />}
      {activeTab === "broadcast" && <BroadcastTab eventId={id} />}
      {activeTab === "michango" && <MichangoTab eventId={id} />}
    </div>
  );
}

// ============================================================================
// MINI STAT HELPER
// ============================================================================
function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function formatTsh(amount: number): string {
  return `TZS ${Math.max(0, amount).toLocaleString("en-TZ")}`;
}

// ============================================================================
// BROADCAST TAB
// ============================================================================
function BroadcastTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [recipientType, setRecipientType] = useState("all");
  const [channels, setChannels] = useState<string[]>(["whatsapp"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [expandedBroadcast, setExpandedBroadcast] = useState<string | null>(null);

  const { data: broadcasts, isLoading } = useQuery({
    queryKey: ["broadcasts", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/broadcasts?per_page=20`)).data.data,
  });

  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery({
    queryKey: ["broadcast-deliveries", eventId, expandedBroadcast],
    queryFn: async () => (await api.get(`/events/${eventId}/broadcasts/${expandedBroadcast}/deliveries`)).data.data,
    enabled: !!expandedBroadcast,
  });

  const sendMutation = useMutation({
    mutationFn: (payload: any) => Promise.all(payload.channels.map((channel: string) => api.post(`/events/${eventId}/broadcast`, { ...payload, channel }))),
    onSuccess: (responses: any[]) => {
      qc.invalidateQueries({ queryKey: ["broadcasts", eventId] });
      setComposeOpen(false);
      setMessage("");
      setChannels(["whatsapp"]);
      setScheduledAt("");
      const sent = responses.reduce((total, response) => total + (response.data.data?.sent ?? 0), 0);
      toast.success(`Broadcast sent through ${responses.length} channel(s) to ${sent} deliveries`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to send broadcast"),
  });

  const handleSend = () => {
    sendMutation.mutate({
      recipient_type: recipientType,
      channels,
      channel: channels[0],
      target: recipientType,
      message,
      scheduled_at: scheduledAt || undefined,
    });
  };

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  return (
    <Card title="Broadcast Messages">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Send messages to guests via SMS, WhatsApp, or Email
        </p>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <Radio className="mr-2 h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading broadcasts...</p>
      ) : !broadcasts || broadcasts.length === 0 ? (
        <div className="py-12 text-center">
          <Radio className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-sm text-slate-500">No broadcasts sent yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b: any) => (
            <div key={b.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{b.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(b.channels ?? [b.channel]).map((ch: string) => (
                      <Badge key={ch} label={ch} variant="blue" />
                    ))}
                    <Badge label={b.target_audience ?? "all"} variant="slate" />
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    label={b.status}
                    variant={b.status === "sent" ? "green" : b.status === "failed" ? "rose" : "amber"}
                  />
                  <p className="mt-1 text-xs text-slate-500">{formatDate(b.created_at)}</p>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-slate-600">
                <span>Sent: <strong className="text-emerald-600">{b.successfully_sent ?? 0}</strong></span>
                <span>Failed: <strong className="text-rose-600">{b.failed_count ?? 0}</strong></span>
                <span>Total: <strong className="text-slate-700">{b.total_recipients ?? 0}</strong></span>
              </div>
              <button onClick={() => setExpandedBroadcast(expandedBroadcast === b.id ? null : b.id)} className="mt-3 text-xs font-semibold text-gold-700 hover:underline">
                {expandedBroadcast === b.id ? "Hide delivery details" : "Show delivery details"}
              </button>
              {expandedBroadcast === b.id && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {deliveriesLoading ? <p className="text-xs text-slate-400">Loading delivery statuses…</p> : deliveries.length === 0 ? <p className="text-xs text-slate-400">No delivery records.</p> : deliveries.map((delivery: any) => (
                    <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-medium text-slate-700">{delivery.guest_name}</span>
                      <Badge label={delivery.channel} variant="blue" />
                      <Badge label={delivery.status} variant={delivery.status === "sent" ? "green" : "rose"} />
                      {delivery.error_message && <span className="text-rose-600">{delivery.error_message}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={composeOpen} onClose={() => setComposeOpen(false)} title="Compose Broadcast" size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your message here..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Recipients</label>
            <Select value={recipientType} onChange={(e) => setRecipientType(e.target.value)}>
              <option value="all">All guests</option>
              <option value="vip">VIP guests only</option>
              <option value="paid">Fully paid pledges</option>
              <option value="partial">Partially paid pledges</option>
              <option value="unpaid">Unpaid pledges</option>
              <option value="special">Special guests / staff</option>
              <option value="unconfirmed">Guests who haven't RSVP'd</option>
              <option value="confirmed">Confirmed attendees</option>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Channels</label>
            <div className="flex flex-wrap gap-2">
              {["whatsapp", "sms", "email", "telegram"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition",
                    channels.includes(ch)
                      ? "border-gold-500 bg-gold-50 text-gold-700"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                  )}
                >
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Schedule (optional)
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave empty to send immediately
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              isLoading={sendMutation.isPending}
              disabled={!message.trim() || channels.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Broadcast
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ============================================================================
// MICHANGO TAB
// ============================================================================
function MichangoTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState<string | null>(null);

  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [pledgeDueDate, setPledgeDueDate] = useState("");
  const [pledgeNotes, setPledgeNotes] = useState("");
  const [isPledgeExempt, setIsPledgeExempt] = useState(false);
  const [defaultPledgeAmount, setDefaultPledgeAmount] = useState(50000);

  const CATEGORY_PLEDGE_DEFAULTS: Record<string, number> = {
    "VVIP": 200000, "VIP": 100000, "Platinum": 250000, "Gold": 150000,
    "Silver": 100000, "Premium": 75000, "Regular": 50000, "Normal": 50000,
    "Family": 0, "Staff": 0, "Service Provider": 0, "Special Guest": 0, "Event Character": 0,
  };

  const { data: response, isLoading } = useQuery({
    queryKey: ["michango", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/michango?per_page=50`)).data,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/invitations`)).data.data,
  });

  const { data: summary } = useQuery({
    queryKey: ["michango-summary", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/michango/summary`)).data.data,
  });

  const { data: guestsData } = useQuery({
    queryKey: ["guests-for-pledge", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/guests?per_page=500`)).data.data,
  });

  const [cardGuest, setCardGuest] = useState<any | null>(null);
  const [cardQrUrl, setCardQrUrl] = useState<string | null>(null);

  const pledges = Array.isArray(response?.data) ? response.data : [];
  const guests = (guestsData ?? []) as any[];

  // Correctly map backend summary fields
  const totalPledged = summary?.total_pledged_tsh ?? 0;
  const totalPaid = summary?.total_collected_tsh ?? 0;
  const totalOutstanding = summary?.total_outstanding_tsh ?? 0;
  const totalPledgesCount = summary?.total_pledgers ?? 0;

  const addPledgeMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/events/${eventId}/michango`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["michango", eventId] });
      qc.invalidateQueries({ queryKey: ["michango-summary", eventId] });
      resetPledgeForm();
      toast.success("Pledge added successfully");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to add pledge"),
  });

  const exemptGuestMutation = useMutation({
    mutationFn: (guestId: string) =>
      api.patch(`/events/${eventId}/guests/${guestId}`, { pledge_exempt: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests-for-pledge", eventId] });
      resetPledgeForm();
      toast.success("Guest marked as Pledge Exempt");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to update guest"),
  });

  // FIXED: Send amount_paid and payment_method to match RecordPaymentRequest
  const paymentMutation = useMutation({
    mutationFn: (payload: { pledgeId: string; amount_paid: number }) =>
      api.post(`/events/${eventId}/michango/${payload.pledgeId}/payment`, {
        amount_paid: payload.amount_paid,
        payment_method: "manual",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["michango", eventId] });
      qc.invalidateQueries({ queryKey: ["michango-summary", eventId] });
      setPaymentOpen(null);
      toast.success("Payment recorded");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const sendGuestInvitationMutation = useMutation({
    mutationFn: ({ guestId, channel }: { guestId: string; channel: string }) =>
      api.post(`/events/${eventId}/invitations/send`, { guest_ids: [guestId], channel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations", eventId] });
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      toast.success("Invitation card sent");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to send invitation"),
  });

  const generateGuestCard = async (guest: any) => {
    try {
      await api.post(`/events/${eventId}/invitations/generate`, { guest_ids: [guest.guest_id], overwrite: false });
      await qc.invalidateQueries({ queryKey: ["invitations", eventId] });
      const refreshed = (await api.get(`/events/${eventId}/invitations`)).data.data ?? [];
      const invitation = refreshed.find((item: any) => item.guest_id === guest.guest_id);
      if (!invitation) throw new Error("Invitation card was not generated");
      const guestRecord = guests.find((item: any) => item.id === guest.guest_id);
      setCardGuest({ ...guest, ...guestRecord, invitation });
      const qr = await api.get(`/events/${eventId}/invitations/${invitation.id}/qr`, { responseType: "blob" });
      setCardQrUrl(URL.createObjectURL(qr.data));
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed to generate card");
    }
  };

  const openGuestCard = async (pledge: any) => {
    const invitation = invitations.find((item: any) => item.guest_id === pledge.guest_id);
    if (!invitation) {
      await generateGuestCard(pledge);
      return;
    }
    const guest = guests.find((item: any) => item.id === pledge.guest_id);
    setCardGuest({ ...pledge, ...guest, invitation });
    try {
      const qr = await api.get(`/events/${eventId}/invitations/${invitation.id}/qr`, { responseType: "blob" });
      setCardQrUrl(URL.createObjectURL(qr.data));
    } catch {
      setCardQrUrl(null);
    }
  };

  // FIXED: Call the correct bulk reminders endpoint with guest_ids
  const reminderMutation = useMutation({
    mutationFn: (guestId: string) =>
      api.post(`/events/${eventId}/michango/reminders`, {
        guest_ids: [guestId],
        statuses: ["pending", "partial", "overdue"],
        channel: "whatsapp",
      }),
    onSuccess: () => toast.success("Reminder sent"),
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const resetPledgeForm = () => {
    setAddOpen(false);
    setSelectedGuestId("");
    setPledgeAmount("");
    setPledgeDueDate("");
    setPledgeNotes("");
    setIsPledgeExempt(false);
  };

  const handleGuestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const guestId = e.target.value;
    setSelectedGuestId(guestId);
    if (guestId) {
      const guest = guests.find((g: any) => g.id === guestId);
      if (guest) {
        const category = guest.guest_category || "Regular";
        const detectedAmount = CATEGORY_PLEDGE_DEFAULTS[category] ?? 50000;
        if (detectedAmount === 0) {
          setIsPledgeExempt(true);
          setPledgeAmount("0");
        } else {
          setIsPledgeExempt(false);
          setPledgeAmount(detectedAmount.toString());
        }
      }
    } else {
      setPledgeAmount("");
      setIsPledgeExempt(false);
    }
  };

  const handleAddPledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPledgeExempt) {
      exemptGuestMutation.mutate(selectedGuestId);
    } else {
      const amountTsh = parseInt(pledgeAmount, 10);
      if (isNaN(amountTsh) || amountTsh <= 0) {
        toast.error("Please enter a valid pledge amount in TZS");
        return;
      }
      addPledgeMutation.mutate({
        guest_id: selectedGuestId,
        pledged_amount: amountTsh,
        payment_deadline: pledgeDueDate || null,
        notes: pledgeNotes || null,
      });
    }
  };

  const progress = totalPledged > 0 ? (totalPaid / totalPledged) * 100 : 0;
  const availableGuests = guests.filter((g: any) => !g.pledge_exempt);
  const selectedGuest = guests.find((g: any) => g.id === selectedGuestId);
  const paymentPledge = pledges.find((pledge: any) => pledge.id === paymentOpen);
  const detectedCategory = selectedGuest?.guest_category || "Regular";
  const detectedDefault = CATEGORY_PLEDGE_DEFAULTS[detectedCategory] ?? 50000;

  return (
    <div className="space-y-6">
      <Card title="Quick Pledge Settings">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-slate-700">Default Pledge Amount (TZS)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-slate-500">TZS</span>
              <input type="number" value={defaultPledgeAmount} onChange={(e) => setDefaultPledgeAmount(parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-slate-300 pl-12 pr-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20" />
            </div>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Pledge
          </Button>
        </div>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard title="Total Pledged" value={formatTsh(totalPledged)} icon={Banknote} color="blue" />
          <StatCard title="Collected" value={formatTsh(totalPaid)} icon={CheckCircle} color="green" />
          <StatCard title="Outstanding" value={formatTsh(totalOutstanding)} icon={AlertCircle} color="gold" />
          <StatCard title="Total Pledgers" value={totalPledgesCount} icon={Users} color="purple" />
        </div>
      )}

      {totalPledged > 0 && (
        <Card title="Collection Progress">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{formatTsh(totalPaid)} collected</span>
              <span className="font-bold text-slate-900">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <p className="text-xs text-slate-500">Target: {formatTsh(totalPledged)}</p>
          </div>
        </Card>
      )}

      <Card title={`Active Pledges (${pledges.length})`}>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading pledges...</p>
        ) : pledges.length === 0 ? (
          <div className="py-12 text-center">
            <Banknote className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">No active pledges recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pledges.map((p: any) => {
              // FIXED: Use correct backend field names
              const pledgedAmount = p.pledged_amount ?? 0;
              const paidAmount = p.amount_paid ?? 0;
              const remainingAmount = p.remaining_amount ?? (pledgedAmount - paidAmount);
              const paidPercent = pledgedAmount > 0 ? (paidAmount / pledgedAmount) * 100 : 0;
              const paymentStatus = p.payment_status ?? "pending";

              return (
                <div key={p.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{p.guest_name}</p>
                      <p className="text-sm text-slate-600">
                        Pledged: {formatTsh(pledgedAmount)}
                        {p.payment_deadline && ` · Due ${formatDate(p.payment_deadline)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {/* FIXED: Only hide button when status is exactly "paid" */}
                      {paymentStatus !== "paid" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setPaymentOpen(p.id)}>
                            Record Payment
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => reminderMutation.mutate(p.guest_id)}>
                            <Bell className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {paymentStatus === "paid" && (
                        <Button size="sm" variant="outline" onClick={() => openGuestCard(p)}>
                          <QrCode className="h-4 w-4" /> Guest card
                        </Button>
                      )}
                      <Badge
                        label={paymentStatus === "paid" ? "Paid in full" : paymentStatus}
                        variant={
                          paymentStatus === "paid" ? "green" :
                          paymentStatus === "overdue" ? "rose" :
                          paymentStatus === "partial" ? "amber" :
                          "slate"
                        }
                      />
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(paidPercent, 100)}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{formatTsh(paidAmount)} paid</span>
                    <span className="font-semibold">{formatTsh(remainingAmount)} remaining</span>
                  </div>
                  {/* FIXED: Show partial payment warning */}
                  {paymentStatus === "partial" && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      Partial payment received: {formatTsh(remainingAmount)} remaining ({paidPercent.toFixed(1)}% complete)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal isOpen={addOpen} onClose={resetPledgeForm} title="Add Pledge" size="md">
        <form onSubmit={handleAddPledge} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Select Guest *</label>
            <select value={selectedGuestId} onChange={handleGuestChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20">
              <option value="">Choose a guest...</option>
              {availableGuests.map((g: any) => (
                <option key={g.id} value={g.id}>{g.full_name} ({g.phone}) - {g.guest_category || "Regular"}</option>
              ))}
            </select>
          </div>

          {selectedGuestId && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 border border-slate-200">
              <span className="font-semibold">Detected Category:</span> {detectedCategory}
              <br />
              <span className="font-semibold">Default Pledge:</span> TZS {detectedDefault.toLocaleString()}
              {isPledgeExempt && <span className="ml-2 font-bold text-emerald-600">(Exempt)</span>}
            </div>
          )}

          <div className={isPledgeExempt ? "opacity-50 pointer-events-none" : ""}>
            <label className="mb-2 block text-sm font-medium text-slate-700">Pledge Amount (TZS) *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-slate-500">TZS</span>
              <input type="number" value={pledgeAmount} onChange={(e) => setPledgeAmount(e.target.value)} placeholder="0" required={!isPledgeExempt} className="w-full rounded-lg border border-slate-300 pl-12 pr-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20" />
            </div>
          </div>

          <div className={isPledgeExempt ? "hidden" : "grid grid-cols-2 gap-4"}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Due Date</label>
              <input type="date" value={pledgeDueDate} onChange={(e) => setPledgeDueDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
              <input type="text" value={pledgeNotes} onChange={(e) => setPledgeNotes(e.target.value)} placeholder="Optional" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={resetPledgeForm}>Cancel</Button>
            <Button type="submit" isLoading={addPledgeMutation.isPending || exemptGuestMutation.isPending} variant={isPledgeExempt ? "outline" : "primary"}>
              {isPledgeExempt ? "Mark as Exempt" : "Add Pledge"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!paymentOpen} onClose={() => setPaymentOpen(null)} title="Record Payment" size="sm">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const amount = parseInt(formData.get("amount") as string, 10) * 1000;
          paymentMutation.mutate({ pledgeId: paymentOpen!, amount_paid: amount });
        }} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Amount Paid (TZS thousands)</label>
            <p className="mb-2 text-xs text-slate-500">Remaining: {formatTsh(paymentPledge?.remaining_amount ?? 0)}</p>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-slate-500">TZS</span>
              <input name="amount" type="number" min="1" max={Math.floor((paymentPledge?.remaining_amount ?? 0) / 1000)} placeholder="e.g. 50 for TZS 50,000" required className="w-full rounded-lg border border-slate-300 pl-12 pr-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setPaymentOpen(null)}>Cancel</Button>
            <Button type="submit" isLoading={paymentMutation.isPending}>Record Payment</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!cardGuest} onClose={() => { setCardGuest(null); if (cardQrUrl) URL.revokeObjectURL(cardQrUrl); setCardQrUrl(null); }} title={`Guest Card — ${cardGuest?.guest_name ?? ""}`} size="md">
        {cardGuest && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Payment complete</p>
              <p className="text-xs">This guest has paid the pledge in full. Send the check-in card below.</p>
            </div>
            {cardGuest.invitation?.scan_url && cardGuest.invitation?.scan_payload && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                {cardGuest.device_type === "feature_phone" ? (
                  <p className="rounded-lg bg-slate-50 px-5 py-4 font-mono text-xl font-bold tracking-[0.3em] text-slate-800">{cardGuest.invitation.scan_payload}</p>
                ) : cardQrUrl ? <img src={cardQrUrl} alt="Guest check-in QR code" className="h-48 w-48" /> : <p className="text-xs text-slate-500">QR preview unavailable</p>}
                <a href={cardGuest.invitation.scan_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-gold-700 hover:underline">Open check-in card</a>
                {cardGuest.device_type === "feature_phone" && <p className="text-xs text-slate-500">SMS check-in token</p>}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => sendGuestInvitationMutation.mutate({ guestId: cardGuest.guest_id, channel: cardGuest.contact_method === "email" ? "email" : "whatsapp" })} isLoading={sendGuestInvitationMutation.isPending}>
                <Send className="h-4 w-4" /> Send {cardGuest.contact_method === "email" ? "Email" : "WhatsApp"}
              </Button>
              {cardGuest.device_type === "feature_phone" && <Button variant="outline" onClick={() => sendGuestInvitationMutation.mutate({ guestId: cardGuest.guest_id, channel: "sms" })} isLoading={sendGuestInvitationMutation.isPending}>
                <Smartphone className="h-4 w-4" /> Send SMS token
              </Button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
// ============================================================================
// GUESTS TAB (WITH BULK ACTIONS)
// ============================================================================
function GuestsTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<string>("");
  const [reminderChannel, setReminderChannel] = useState<string>("sms");
  const [pledgeChannel, setPledgeChannel] = useState<string>("whatsapp");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pledgeFilter, setPledgeFilter] = useState("");
  const [editGuest, setEditGuest] = useState<any | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ["guests", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/guests?per_page=100`)).data,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/invitations`)).data.data,
  });

  const { data: pledgeResponse = [] } = useQuery({
    queryKey: ["guest-pledge-status", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/michango?per_page=500`)).data.data,
  });

  const guests = (response?.data ?? []) as any[];
  const guestRows = guests.map((guest: any) => ({
    ...guest,
    invitation: invitations.find((invitation: any) => invitation.guest_id === guest.id),
    pledge: pledgeResponse.find((pledge: any) => pledge.guest_id === guest.id),
  }));
  const visibleGuests = guestRows.filter((guest: any) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [guest.full_name, guest.phone, guest.email].some((value) => String(value ?? "").toLowerCase().includes(needle));
    return matchesSearch && (!categoryFilter || guest.guest_category === categoryFilter) && (!pledgeFilter || guest.pledge?.payment_status === pledgeFilter);
  });

  const sendInvitationsMutation = useMutation({
    mutationFn: async (payload: { guest_ids: string[]; channel?: string }) => {
      await api.post(`/events/${eventId}/invitations/generate`, { guest_ids: payload.guest_ids, overwrite: false });
      return api.post(`/events/${eventId}/invitations/send`, payload);
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      qc.invalidateQueries({ queryKey: ["invitations", eventId] });
      qc.invalidateQueries({ queryKey: ["event-summary", eventId] });
      setSelectedGuests(new Set());
      setBulkActionOpen(false);
      toast.success(`Invitations sent to ${r.data.data?.sent ?? selectedGuests.size} guests`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to send invitations"),
  });

  const generateLinksMutation = useMutation({
    mutationFn: (payload: { guest_ids: string[] }) =>
      api.post(`/events/${eventId}/invitations/generate`, payload),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      setSelectedGuests(new Set());
      setBulkActionOpen(false);
      qc.invalidateQueries({ queryKey: ["invitations", eventId] });
      toast.success(`Invitation links generated`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to generate links"),
  });

  const sendReminderMutation = useMutation({
    mutationFn: (payload: { guest_ids: string[]; channel: string; message?: string }) =>
      api.post(`/events/${eventId}/broadcast`, {
        recipient_type: "guests",
        guest_ids: payload.guest_ids,
        channel: payload.channel,
        message: payload.message || `Reminder: You're invited to our event! Please check your invitation.`,
      }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      setSelectedGuests(new Set());
      setBulkActionOpen(false);
      toast.success(`Reminders sent via ${reminderChannel} to ${r.data.data?.sent ?? selectedGuests.size} guests`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to send reminders"),
  });

  const addMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/events/${eventId}/guests`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guests", eventId] }); setAddOpen(false); toast.success("Guest added"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ guestId, payload }: { guestId: string; payload: any }) => api.put(`/events/${eventId}/guests/${guestId}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guests", eventId] }); setEditGuest(null); toast.success("Guest updated"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to update guest"),
  });

  const deleteMutation = useMutation({
    mutationFn: (guestId: string) => api.delete(`/events/${eventId}/guests/${guestId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guests", eventId] }); toast.success("Guest removed"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to remove guest"),
  });

  const downloadTemplate = async () => {
    try {
      const r = await api.get(`/events/${eventId}/guests/template`, { responseType: "blob" });
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guest-import-template-${eventId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Template downloaded");
    } catch {
      toast.error("Failed to download template");
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile) throw new Error("No CSV file selected");
      const form = new FormData();
      form.append("file", csvFile);
      return api.post(`/events/${eventId}/guests/import`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: (r: any) => {
      const result = r.data?.data ?? r.data;
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      qc.invalidateQueries({ queryKey: ["event-summary", eventId] });
      setImportOpen(false);
      setCsvFile(null);
      const imported = result?.imported ?? 0;
      const skipped = result?.skipped ?? 0;
      toast.success(`Imported ${imported} guest(s)${skipped ? `, skipped ${skipped}` : ""}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Import failed"),
  });

  const toggleGuest = (guestId: string) => {
    const newSet = new Set(selectedGuests);
    if (newSet.has(guestId)) newSet.delete(guestId);
    else newSet.add(guestId);
    setSelectedGuests(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedGuests.size === guests.length) setSelectedGuests(new Set());
    else setSelectedGuests(new Set(guests.map((g: any) => g.id)));
  };

  const handleBulkAction = (action: string, guestId?: string) => {
    if (guestId) setSelectedGuests(new Set([guestId]));
    setBulkActionType(action);
    setBulkActionOpen(true);
  };

  const executeBulkAction = () => {
    const guestIds = Array.from(selectedGuests);
    if (bulkActionType === "send_invitation") {
      sendInvitationsMutation.mutate({ guest_ids: guestIds, channel: pledgeChannel });
    } else if (bulkActionType === "generate_links") {
      generateLinksMutation.mutate({ guest_ids: guestIds });
    } else if (bulkActionType === "send_reminder") {
      sendReminderMutation.mutate({ guest_ids: guestIds, channel: reminderChannel });
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedGuests);
    for (const guestId of ids) await deleteMutation.mutateAsync(guestId);
    setSelectedGuests(new Set());
  };

  const handleUpdateGuest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editGuest) return;
    const form = event.currentTarget;
    updateMutation.mutate({
      guestId: editGuest.id,
      payload: {
        full_name: (form.elements.namedItem("full_name") as HTMLInputElement).value,
        phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
        email: (form.elements.namedItem("email") as HTMLInputElement).value || undefined,
        guest_category: (form.elements.namedItem("guest_category") as HTMLSelectElement).value,
        table_number: (form.elements.namedItem("table_number") as HTMLInputElement).value || undefined,
        contact_method: (form.elements.namedItem("contact_method") as HTMLSelectElement).value,
      },
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      key: "select",
      label: " ",
      render: (g) => (
        <button onClick={() => toggleGuest(g.id)} className="p-1">
          {selectedGuests.has(g.id) ? (
            <CheckSquare className="h-4 w-4 text-gold-600" />
          ) : (
            <Square className="h-4 w-4 text-slate-400" />
          )}
        </button>
      ),
    },
    { key: "full_name", label: "Name", sortable: true, render: (g) => <span className="font-medium text-slate-900">{g.full_name}</span> },
    { key: "phone", label: "Phone", sortable: true, render: (g) => <span className="text-slate-500">{g.phone}</span> },
    {
      key: "device_type",
      label: "Device",
      render: (g) => <Badge label={g.device_type === "feature_phone" ? "Feature phone" : "Smartphone"} variant={g.device_type === "feature_phone" ? "amber" : "green"} />,
    },
    {
      key: "guest_category",
      label: "Category",
      render: (g) => <Badge label={g.guest_category ?? "Regular"} variant="blue" />,
    },
    { key: "table_number", label: "Table", render: (g) => <span className="text-slate-600">{g.table_number ?? "—"}</span> },
    {
      key: "invitation_status",
      label: "Invitation",
      render: (g) => {
        const status = g.invitation_status ?? "pending";
        const variants: Record<string, string> = {
          sent: "blue", opened: "purple", confirmed: "green", declined: "rose", pending: "slate",
        };
        return <Badge label={status} variant={variants[status] ?? "slate"} />;
      },
    },
    {
      key: "pledge_status",
      label: "Pledge",
      render: (g) => <Badge label={g.pledge ? (g.pledge.payment_status === "paid" ? "Paid in full" : g.pledge.payment_status) : "No pledge"} variant={g.pledge?.payment_status === "paid" ? "green" : g.pledge?.payment_status === "partial" ? "amber" : "slate"} />,
    },
    {
      key: "actions",
      label: " ",
      render: (g) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (!g.invitation?.public_url) return toast.error("Generate an invitation link first");
              navigator.clipboard.writeText(g.invitation.public_url).then(() => toast.success("Invitation link copied"));
            }}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            title="Copy invitation link"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleBulkAction("send_reminder", g.id)}
            className="rounded p-1 text-gold-600 hover:bg-gold-50"
            title="Send reminder"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleBulkAction("send_invitation", g.id)}
            className="rounded p-1 text-sky-600 hover:bg-sky-50"
            title="Send invitation"
          >
            <Send className="h-4 w-4" />
          </button>
          <button onClick={() => setEditGuest(g)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Edit guest">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => { if (window.confirm(`Remove ${g.full_name}?`)) deleteMutation.mutate(g.id); }} className="rounded p-1 text-rose-600 hover:bg-rose-50" title="Remove guest">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const handleAddGuest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    addMutation.mutate({
      full_name: (f.elements.namedItem("full_name") as HTMLInputElement).value,
      phone: (f.elements.namedItem("phone") as HTMLInputElement).value,
      email: (f.elements.namedItem("email") as HTMLInputElement).value || undefined,
      whatsapp_phone: (f.elements.namedItem("whatsapp_phone") as HTMLInputElement).value || undefined,
      table_number: (f.elements.namedItem("table_number") as HTMLInputElement).value || undefined,
      guest_category: (f.elements.namedItem("guest_category") as HTMLSelectElement).value || undefined,
      plus_one_allowed: (f.elements.namedItem("plus_one_allowed") as HTMLInputElement).checked,
      contact_method: (f.elements.namedItem("contact_method") as HTMLSelectElement).value || "whatsapp",
      device_type: (f.elements.namedItem("device_type") as HTMLSelectElement).value || "smartphone",
      pledge_exempt: (f.elements.namedItem("pledge_exempt") as HTMLInputElement).checked, // <-- ADD THIS
    });
  };

  const hasSentInvitations = guestRows.some((g: any) => g.invitation?.status === "sent" || g.invitation?.status === "opened");

  return (
    <Card title={`Guests (${guests.length})`}>
      {/* Bulk Action Bar */}
      {selectedGuests.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-200 bg-gold-50 p-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-gold-600" />
            <span className="text-sm font-semibold text-slate-900">{selectedGuests.size} guest(s) selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("send_invitation")}>
              <Mail className="h-3.5 w-3.5" /> Send Pledge Card
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("generate_links")}>
              <QrCode className="h-3.5 w-3.5" /> Generate Links
            </Button>
            {hasSentInvitations && (
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("send_reminder")}>
                <Bell className="h-3.5 w-3.5" /> Send Reminder
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedGuests(new Set())}>
              Clear selection
            </Button>
            <Button size="sm" variant="danger" onClick={() => { if (window.confirm(`Remove ${selectedGuests.size} guest(s)?`)) deleteSelected(); }} isLoading={deleteMutation.isPending}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={toggleSelectAll} className="p-1">
            {selectedGuests.size === guests.length && guests.length > 0 ? (
              <CheckSquare className="h-5 w-5 text-gold-600" />
            ) : (
              <Square className="h-5 w-5 text-slate-400" />
            )}
          </button>
          <span className="text-sm text-slate-600">Select all guests</span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, phone, email" />
          <Select label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option><option value="VIP">VIP</option><option value="Regular">Regular</option><option value="Special Guest">Special guest</option><option value="Staff">Staff</option>
          </Select>
          <Select label="Pledge status" value={pledgeFilter} onChange={(event) => setPledgeFilter(event.target.value)}>
            <option value="">All pledge statuses</option><option value="paid">Paid in full</option><option value="partial">Partial</option><option value="pending">Unpaid</option><option value="overdue">Overdue</option>
          </Select>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" /> CSV template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add guest
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-6 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleGuests.map((g: any) => (
                <tr key={g.id} className={cn("transition hover:bg-slate-50", selectedGuests.has(g.id) && "bg-gold-50/50")}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render ? col.render(g) : g[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {visibleGuests.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No guests match the current filters.</p>}
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      <Modal isOpen={bulkActionOpen} onClose={() => setBulkActionOpen(false)} title="Confirm Bulk Action" size="md">
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {bulkActionType === "send_invitation" && "Send Pledge Cards"}
              {bulkActionType === "generate_links" && "Generate Invitation Links"}
              {bulkActionType === "send_reminder" && "Send Reminder Messages"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              This action will be applied to <strong>{selectedGuests.size}</strong> selected guest(s).
            </p>
          </div>
          {bulkActionType === "send_reminder" && (
            <Select label="Reminder Channel" value={reminderChannel} onChange={(e) => setReminderChannel(e.target.value)}>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="telegram">Telegram</option>
            </Select>
          )}
          {bulkActionType === "send_invitation" && (
            <Select label="Pledge card channel" value={pledgeChannel} onChange={(e) => setPledgeChannel(e.target.value)}>
              <option value="whatsapp">WhatsApp</option><option value="sms">SMS token</option><option value="email">Email</option><option value="telegram">Telegram</option>
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBulkActionOpen(false)}>Cancel</Button>
            <Button
              onClick={executeBulkAction}
              isLoading={sendInvitationsMutation.isPending || generateLinksMutation.isPending || sendReminderMutation.isPending}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editGuest} onClose={() => setEditGuest(null)} title={`Edit Guest — ${editGuest?.full_name ?? ""}`} size="md">
        {editGuest && <form onSubmit={handleUpdateGuest} className="space-y-4">
          <Input label="Full name" name="full_name" defaultValue={editGuest.full_name} required />
          <Input label="Phone" name="phone" defaultValue={editGuest.phone} required />
          <Input label="Email" name="email" type="email" defaultValue={editGuest.email ?? ""} />
          <div className="grid grid-cols-2 gap-4"><Input label="Table" name="table_number" defaultValue={editGuest.table_number ?? ""} /><Select label="Category" name="guest_category" defaultValue={editGuest.guest_category ?? "Regular"}><option value="VIP">VIP</option><option value="Regular">Regular</option><option value="Special Guest">Special Guest</option><option value="Staff">Staff</option></Select></div>
          <Select label="Contact method" name="contact_method" defaultValue={editGuest.contact_method ?? "whatsapp"}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option><option value="telegram">Telegram</option></Select>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setEditGuest(null)}>Cancel</Button><Button type="submit" isLoading={updateMutation.isPending}>Save</Button></div>
        </form>}
      </Modal>

      {/* Add guest modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Guest" size="lg">
        <form onSubmit={handleAddGuest} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full name *" name="full_name" required />
            <Input label="Phone *" name="phone" type="tel" placeholder="+255700000000" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" name="email" type="email" />
            <Input label="WhatsApp phone" name="whatsapp_phone" type="tel" placeholder="Leave blank to use Phone" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Table number" name="table_number" />
            <Select label="Category" name="guest_category" defaultValue="Regular">
              <option value="VVIP">VVIP</option>
              <option value="VIP">VIP</option>
              <option value="Platinum">Platinum</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="Premium">Premium</option>
              <option value="Regular">Regular</option>
              <option value="Normal">Normal</option>
              <option value="Family">Family</option>
              <option value="Staff">Staff</option>
              <option value="Service Provider">Service Provider</option>
              <option value="Special Guest">Special Guest</option>
              <option value="Event Character">Event Character</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Device" name="device_type" defaultValue="smartphone">
              <option value="smartphone">Smartphone (QR code)</option>
              <option value="feature_phone">Feature phone (SMS link + OTP)</option>
            </Select>
            <Select label="Contact method" name="contact_method" defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="telegram">Telegram</option>
            </Select>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              name="pledge_exempt"
              className="h-4 w-4 rounded accent-gold-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900">Pledge Exempt</span>
              <p className="text-xs text-slate-500">
                Mark this guest as a special person (e.g., MC, Sponsor) who is not expected to contribute.
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="plus_one_allowed" className="h-4 w-4 rounded accent-gold-500" />
            <span className="text-sm font-medium text-slate-700">Plus-one allowed (guest may bring a +1)</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={addMutation.isPending}>Add guest</Button>
          </div>
        </form>
      </Modal>

      {/* CSV import modal */}
      <Modal isOpen={importOpen} onClose={() => setImportOpen(false)} title="Import Guests from CSV" size="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
            <FileUp className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-semibold">CSV format</p>
              <p className="mt-0.5 text-xs">
                Required columns: <code>full_name</code>, <code>phone</code>. Optional: email, whatsapp_phone, device_type, table_number, guest_category, plus_one_allowed, contact_method.
              </p>
            </div>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:font-semibold file:text-navy-950"
          />
          {csvFile && (
            <p className="text-xs text-slate-500">Selected: <span className="font-mono">{csvFile.name}</span> ({Math.round(csvFile.size / 1024)} KB)</p>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" /> Download template
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button onClick={() => importMutation.mutate()} isLoading={importMutation.isPending} disabled={!csvFile}>
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ============================================================================
// EVENT STAFF TAB
// ============================================================================
function EventStaffTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>("");

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["event-staff", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/staff`)).data.data,
  });

  const staff = staffData ?? [];

  const { data: availableData, isLoading: availLoading } = useQuery({
    queryKey: ["event-staff-available", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/staff/available`)).data.data,
  });

  const available = availableData ?? [];

  const assignMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/events/${eventId}/staff`, { user_id: userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-staff", eventId] }); setAssignOpen(false); setSelectedStaff(""); toast.success("Staff assigned"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/events/${eventId}/staff/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-staff", eventId] }); toast.success("Staff removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Card title="Event Staff">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Assign account staff members to this event for scanning, hosting, or support roles.</p>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          <Plus className="h-4 w-4" /> Assign staff
        </Button>
      </div>

      {staffLoading ? (
        <p className="text-sm text-slate-500">Loading staff…</p>
      ) : staff.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No staff assigned yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {["Name", "Email", "Role", "Assigned", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s: any) => (
                <tr key={s.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.user_full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.user_email}</td>
                  <td className="px-4 py-3"><Badge label={s.user_role} variant="blue" /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeMutation.mutate(s.user_id)} className="rounded p-1 text-rose-600 hover:bg-rose-50" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Staff" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Select an account staff member to assign to this event.</p>
          {availLoading ? (
            <p className="text-sm text-slate-500">Loading available staff…</p>
          ) : (
            <Select label="Staff member" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
              <option value="">Select staff member</option>
              {available.map((u: any) => <option key={u.id} value={u.id}>{u.full_name} ({ROLE_LABELS[u.role] ?? u.role})</option>)}
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (selectedStaff) assignMutation.mutate(selectedStaff); }} isLoading={assignMutation.isPending}>Assign</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
