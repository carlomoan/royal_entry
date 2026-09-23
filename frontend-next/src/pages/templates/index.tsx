"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Edit2, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Select, Textarea } from "@/components/ui";

export default function MessageTemplatesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => (await api.get("/message-templates")).data.data,
  });

  const templates = data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/message-templates", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["message-templates"] }); setCreateOpen(false); toast.success("Template created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const previewMutation = useMutation({
    mutationFn: (template: any) => api.post(`/message-templates/${template.id}/preview`, {
      guest_name: "Amina Hassan",
      event_title: "RoyalEntry Celebration",
      card_url: "https://royalentry.app/invitation/demo",
    }),
    onSuccess: (response) => setPreview(response.data.data),
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Preview failed"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    createMutation.mutate({
      name: (f.elements.namedItem("name") as HTMLInputElement).value,
      channel_kind: (f.elements.namedItem("channel_kind") as HTMLSelectElement).value,
      subject: (f.elements.namedItem("subject") as HTMLInputElement).value || undefined,
      body: (f.elements.namedItem("body") as HTMLTextAreaElement).value,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Message Templates</h1>
          <p className="text-sm text-slate-500">Reusable templates for SMS, WhatsApp, Email and Telegram broadcasts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-3.5 w-3.5" /> New Template</Button>
      </div>

      <Card title="Templates">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No templates yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Name", "Channel", "Subject", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((t: any) => (
                  <tr key={t.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="px-4 py-3"><Badge label={t.channel_kind} variant="blue" /></td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{t.subject || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setSelectedTemplate(t); setPreview(null); setPreviewOpen(true); previewMutation.mutate(t); }} className="rounded p-1 text-gold-700 hover:bg-gold-50" title="Render preview"><Eye className="h-4 w-4" /></button>
                        <button className="rounded p-1 text-slate-400 hover:bg-slate-50"><Edit2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create template modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Message Template" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Template name" name="name" required />
          <Select label="Channel" name="channel_kind" required>
            <option value="">Select channel</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="telegram">Telegram</option>
          </Select>
          <Input label="Subject (email only)" name="subject" />
          <Textarea label="Body (Handlebars variables: {{guest_name}}, {{event_title}}, {{card_url}})" name="body" rows={6} required />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Preview modal */}
      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview Template" size="lg">
        {selectedTemplate && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">{selectedTemplate.name}</p>
              <p className="text-slate-500">Channel: <Badge label={selectedTemplate.channel_kind} variant="blue" /></p>
              <p className="text-slate-500">Subject: {selectedTemplate.subject || "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm whitespace-pre-wrap text-slate-700">
              {previewMutation.isPending ? "Rendering…" : preview?.rendered_body ?? selectedTemplate.body}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setPreviewOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
