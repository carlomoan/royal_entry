"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QrCode, Copy, Download, RefreshCw, CheckSquare, Square, Mail } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Select } from "@/components/ui";

export default function GuestQRManagementPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendChannel, setSendChannel] = useState("whatsapp");

  // ✅ NEW: Event Selector State
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Fetch all events for the dropdown
  const { data: events = [] } = useQuery({
    queryKey: ["events-qr-management"],
    queryFn: async () => (await api.get("/events?per_page=100")).data.data,
  });

  // Fetch guests and invitations for the SELECTED event
  const { data: guests = [], isLoading } = useQuery({
    queryKey: ["guests-qr", selectedEventId],
    queryFn: async () => (await api.get(`/events/${selectedEventId}/guests?per_page=100`)).data.data,
    enabled: !!selectedEventId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations-qr", selectedEventId],
    queryFn: async () => (await api.get(`/events/${selectedEventId}/invitations`)).data.data,
    enabled: !!selectedEventId,
  });

  const regenerateMutation = useMutation({
    mutationFn: (guestIds: string[]) => api.post(`/events/${selectedEventId}/invitations/generate`, { guest_ids: guestIds, overwrite: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invitations-qr", selectedEventId] }); setRegenerateOpen(false); toast.success("Links regenerated"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const sendInvitationMutation = useMutation({
    mutationFn: (payload: { guest_ids: string[]; channel: string }) => api.post(`/events/${selectedEventId}/invitations/send`, payload),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["invitations-qr", selectedEventId] }); setSendOpen(false); toast.success(`Sent to ${r.data.data?.sent ?? 0} guests`); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const toggleGuest = (guestId: string) => {
    const newSet = new Set(selectedGuests);
    if (newSet.has(guestId)) newSet.delete(guestId);
    else newSet.add(guestId);
    setSelectedGuests(newSet);
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guest QR/Link Management</h1>
          <p className="text-sm text-slate-500">Manage invitation links and QR codes for your guests</p>
        </div>
      </div>

      {/* ✅ Event Selector Dropdown */}
      <Card>
        <div className="flex items-center gap-4">
          <QrCode className="h-8 w-8 text-gold-600" />
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Select Event to Manage</label>
            <Select value={selectedEventId} onChange={(e) => { setSelectedEventId(e.target.value); setSelectedGuests(new Set()); }}>
              <option value="">— Choose an event —</option>
              {events.map((event: any) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {selectedEventId && (
        <>
          {/* Bulk Action Bar */}
          {selectedGuests.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-200 bg-gold-50 p-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-gold-600" />
                <span className="text-sm font-semibold text-slate-900">{selectedGuests.size} guest(s) selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setRegenerateOpen(true)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate Links
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>
                  <Mail className="h-3.5 w-3.5" /> Send Invitations
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedGuests(new Set())}>
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Guests Table */}
          <Card>
            {isLoading ? (
              <p className="py-6 text-sm text-slate-500">Loading guests...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Guest</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Invitation Link</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {guests.map((guest: any) => {
                      const invitation = invitations.find((inv: any) => inv.guest_id === guest.id);
                      const shortLink = invitation?.short_link || "Not generated";
                      const fullLink = invitation ? `${window.location.origin}/g/${invitation.short_link}` : "";
                      return (
                        <tr key={guest.id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <button onClick={() => toggleGuest(guest.id)}>
                              {selectedGuests.has(guest.id) ? <CheckSquare className="h-4 w-4 text-gold-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{guest.full_name}</td>
                          <td className="px-4 py-3 text-slate-500">{guest.phone}</td>
                          <td className="px-4 py-3"><Badge label={guest.guest_category || "Regular"} variant="blue" /></td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">{shortLink}</code>
                          </td>
                          <td className="px-4 py-3"><Badge label={invitation?.status || "pending"} /></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => copyLink(fullLink)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Copy link">
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Regenerate Modal */}
      <Modal isOpen={regenerateOpen} onClose={() => setRegenerateOpen(false)} title="Regenerate Invitation Links" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Regenerate links for {selectedGuests.size} selected guest(s)?</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRegenerateOpen(false)}>Cancel</Button>
            <Button onClick={() => regenerateMutation.mutate(Array.from(selectedGuests))} isLoading={regenerateMutation.isPending}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Invitations Modal */}
      <Modal isOpen={sendOpen} onClose={() => setSendOpen(false)} title="Send Invitations" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Send invitations to {selectedGuests.size} selected guest(s) via:</p>
          <Select value={sendChannel} onChange={(e) => setSendChannel(e.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="telegram">Telegram</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={() => sendInvitationMutation.mutate({ guest_ids: Array.from(selectedGuests), channel: sendChannel })} isLoading={sendInvitationMutation.isPending}>
              <Mail className="h-4 w-4" /> Send Invitations
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
