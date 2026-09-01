"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft, ArrowUpRight, Banknote, Radio, ScanLine, Users, Zap, QrCode, FileText, Mail,
  UserPlus, Upload, Download, FileUp,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, StatCard, Modal, Input, Select } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatDate } from "@/lib/utils";

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
    mutationFn: () => api.post(`/events/${id}/invitations/send`),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["event-summary", id] }); toast.success(`Invitations sent to ${r.data.data.sent} guests`); },
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
            <Button onClick={() => sendInvitationsMutation.mutate()} isLoading={sendInvitationsMutation.isPending} variant="outline" size="sm">
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
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === key ? "bg-navy-950 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
        <button onClick={() => router.push(`/events/${id}/scanner`)} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gold-700 transition hover:bg-gold-50">
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
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function GuestsTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ["guests", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/guests`)).data,
  });
  const guests = (response?.data ?? []) as any[];

  const addMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/events/${eventId}/guests`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guests", eventId] }); setAddOpen(false); toast.success("Guest added"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
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

  const columns: ColumnDef<any>[] = [
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
      key: "rsvp_response",
      label: "Status",
      render: (g) => <Badge label={g.rsvp_response ?? "pending"} />,
    },
  ];

  const handleAddGuest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const device_type = (f.elements.namedItem("device_type") as HTMLSelectElement).value || "smartphone";
    addMutation.mutate({
      full_name: (f.elements.namedItem("full_name") as HTMLInputElement).value,
      phone: (f.elements.namedItem("phone") as HTMLInputElement).value,
      email: (f.elements.namedItem("email") as HTMLInputElement).value || undefined,
      whatsapp_phone: (f.elements.namedItem("whatsapp_phone") as HTMLInputElement).value || undefined,
      table_number: (f.elements.namedItem("table_number") as HTMLInputElement).value || undefined,
      guest_category: (f.elements.namedItem("guest_category") as HTMLSelectElement).value || undefined,
      plus_one_allowed: (f.elements.namedItem("plus_one_allowed") as HTMLInputElement).checked,
      contact_method: (f.elements.namedItem("contact_method") as HTMLSelectElement).value || "whatsapp",
      device_type,
    });
  };

  return (
    <Card title={`Guests (${guests.length})`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Add guests individually or import a CSV file.</p>
        <div className="flex flex-wrap gap-2">
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
        <DataTable
          data={guests}
          columns={columns}
          searchPlaceholder="Search guests by name, phone, or table..."
          searchFields={["full_name", "phone", "table_number"]}
          sortField="full_name"
          pageSize={20}
          emptyMessage="No guests yet — click Add guest to create one"
        />
      )}

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
              <option value="Normal">Normal</option>
              <option value="Premium">Premium</option>
              <option value="Regular">Regular</option>
              <option value="Staff">Staff</option>
              <option value="Family">Family</option>
              <option value="Service Provider">Service Provider</option>
              <option value="Special Guest">Special Guest</option>
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