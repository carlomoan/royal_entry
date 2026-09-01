"use client";

import { useQuery } from "@tanstack/react-query";
import { Webhook, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function WebhooksPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["platform-webhooks"],
    queryFn: async () => (await api.get("/platform/webhooks")).data.data,
  });

  const createWebhook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const url = (f.elements.namedItem("url") as HTMLInputElement).value;
    try {
      await api.post("/platform/webhooks", { url, events: ["event.created", "guest.checked_in"] });
      toast.success("Webhook created");
      setCreateOpen(false);
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  const deleteWebhook = async (id: string) => {
    try {
      await api.delete(`/platform/webhooks/${id}`);
      toast.success("Webhook deleted");
      setDeleteConfirm(null);
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Webhooks</h1>
          <p className="text-sm text-slate-500">Configure HTTP callbacks for events</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add endpoint</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : webhooks.length === 0 ? (
        <Card><div className="py-12 text-center"><Webhook className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No webhooks configured</p></div></Card>
      ) : (
        <Card title="Webhook Endpoints">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["URL", "Events", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {webhooks.map((w: any) => (
                  <tr key={w.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-900">{w.url}</td>
                    <td className="px-4 py-3"><Badge label={`${w.events?.length ?? 0} events`} variant="slate" /></td>
                    <td className="px-4 py-3"><Badge label={w.is_active ? "active" : "inactive"} variant={w.is_active ? "green" : "slate"} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(w.created_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteConfirm(w.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Webhook" size="lg">
        <form onSubmit={createWebhook} className="space-y-4">
          <Input label="URL" name="url" type="url" placeholder="https://your-app.com/webhook" required />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Webhook" size="sm">
        <p className="text-sm text-slate-600">Delete this webhook?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteWebhook(deleteConfirm!)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}