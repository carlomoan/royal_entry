"use client";
// Arrival-message editor: per-event/class messages with scheduled release.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Badge, Input } from "@/components/ui";

export default function ArrivalMessagesEditor({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [contribution, setContribution] = useState("");
  const [releaseAt, setReleaseAt] = useState("");

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["arrival-messages", eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/arrival-messages`)).data.data ?? [],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["arrival-messages", eventId] });
  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/events/${eventId}/arrival-messages`, {
        title, body,
        guest_category: category || undefined,
        media_url: mediaUrl || undefined,
        media_type: mediaUrl ? mediaType : undefined,
        contribution_block: contribution || undefined,
        release_at: releaseAt || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setTitle(""); setBody(""); setCategory(""); setMediaUrl(""); setContribution(""); setReleaseAt("");
      toast.success("Arrival message added");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to add message"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${eventId}/arrival-messages/${id}`),
    onSuccess: () => { invalidate(); toast.success("Message removed"); },
    onError: () => toast.error("Failed to remove message"),
  });

  return (
    <Card title="Arrival messages">
      <p className="mb-4 text-sm text-slate-500">
        Welcome messages shown to guests after check-in (on their card page and the venue QR). Leave class empty for all guests.
      </p>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : messages.length > 0 ? (
        <div className="mb-5 space-y-2">
          {messages.map((m: any) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{m.title}</p>
                  <Badge label={m.guest_category ?? "All guests"} variant={m.guest_category ? "gold" : "slate"} />
                  {!m.is_active && <Badge label="Inactive" variant="slate" />}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{m.body}</p>
                {m.release_at && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" /> Released {new Date(m.release_at).toLocaleString()}
                  </p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteMutation.mutate(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Karibu! / Welcome" />
          <Input label="Guest class (optional)" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="VVIP, General…" />
        </div>
        <label className="block text-xs font-semibold text-slate-600">Message body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Your welcome message…" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Media link (optional)" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Media type</label>
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400">
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </div>
        </div>
        <Input label="How to contribute (optional)" value={contribution} onChange={(e) => setContribution(e.target.value)} placeholder="Lipa: 123456 · M-Pesa…" />
        <Input label="Release at (optional)" type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} disabled={!title.trim() || !body.trim()}>
            <Plus className="h-4 w-4" /> Add message
          </Button>
        </div>
      </div>
    </Card>
  );
}