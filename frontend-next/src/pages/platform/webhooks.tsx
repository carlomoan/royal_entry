"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Webhook, Plus, Trash2, FlaskConical, History, RefreshCw, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input } from "@/components/ui";
import { formatDate, cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, string> = {
  success: "green", delivering: "blue", pending: "blue",
  failed: "rose", abandoned: "slate",
};

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<{ id: string; url: string } | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["platform-webhooks"],
    queryFn: async () => (await api.get("/platform/webhooks")).data.data,
  });

  const { data: deliveries = [], isLoading: dLoading, refetch } = useQuery({
    queryKey: ["webhook-deliveries", deliveriesFor?.id],
    queryFn: async () => (await api.get(`/platform/webhooks/${deliveriesFor!.id}/deliveries`)).data.data,
    enabled: !!deliveriesFor,
    refetchInterval: deliveriesFor ? 5000 : false,
  });

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post("/platform/webhooks", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-webhooks"] }); setCreateOpen(false); toast.success("Webhook created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/webhooks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-webhooks"] }); setDeleteConfirm(null); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/webhooks/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-webhooks"] }); setEditWebhook(null); toast.success("Webhook updated"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Update failed"),
  });
  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/platform/webhooks/${id}/test`),
    onSuccess: (r: any) => {
      toast.success(`Test delivered: ${r.data.data.status}`);
      qc.invalidateQueries({ queryKey: ["webhook-deliveries"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Test failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Webhooks</h1>
          <p className="text-sm text-slate-500">HTTP callbacks with signed deliveries, retries and logs</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add endpoint</Button>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : webhooks.length === 0 ? (
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
                      <div className="flex items-center gap-1.5">
                        <button title="Send test" onClick={() => testMutation.mutate(w.id)} className="rounded p-1 text-emerald-600 hover:bg-emerald-50"><FlaskConical className="h-4 w-4" /></button>
                        <button title="Delivery logs" onClick={() => setDeliveriesFor({ id: w.id, url: w.url })} className="rounded p-1 text-sky-600 hover:bg-sky-50"><History className="h-4 w-4" /></button>
                        <button title="Edit" onClick={() => setEditWebhook(w)} className="rounded p-1 text-gold-700 hover:bg-gold-50"><Edit2 className="h-4 w-4" /></button>
                        <button title="Delete" onClick={() => setDeleteConfirm(w.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Webhook" size="lg">
        <CreateForm onSubmit={(p) => createMutation.mutate(p)} />
      </Modal>

      <Modal isOpen={!!editWebhook} onClose={() => setEditWebhook(null)} title="Edit Webhook" size="lg">
        {editWebhook && <CreateForm initial={editWebhook} submitLabel="Save changes" onSubmit={(p) => updateMutation.mutate({ id: editWebhook.id, payload: p })} />}
      </Modal>

      {/* Delivery logs modal */}
      <Modal isOpen={!!deliveriesFor} onClose={() => setDeliveriesFor(null)} title={`Delivery Logs — ${deliveriesFor?.url ?? ""}`} size="lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">Latest 50 attempts (auto-refreshes every 5s)</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
        {dLoading ? <p className="py-8 text-center text-sm text-slate-400">Loading…</p> : deliveries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No deliveries yet — send a test.</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {deliveries.map((d: any) => (
              <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-800">{d.event_type}</span>
                  <Badge label={d.status} variant={STATUS_VARIANT[d.status] ?? "slate"} />
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <span>attempt {d.attempt}</span>
                  {d.response_status != null && <span>HTTP {d.response_status}</span>}
                  <span>{formatDate(d.created_at)}</span>
                  {d.next_retry_at && <span>retry at {formatDate(d.next_retry_at)}</span>}
                </div>
                {d.error && <p className="mt-1 break-words text-[11px] text-rose-600">{d.error}</p>}
                {d.response_body && <pre className="mt-1 max-h-24 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-600">{d.response_body}</pre>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Webhook" size="sm">
        <p className="text-sm text-slate-600">Delete this webhook?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function CreateForm({ onSubmit, initial, submitLabel = "Create" }: { onSubmit: (p: any) => void; initial?: any; submitLabel?: string }) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [events, setEvents] = useState<string[]>(initial?.events ?? ["event.created", "guest.checked_in"]);
  const ALL = ["event.created", "event.activated", "event.completed", "guest.created", "guest.checked_in", "payment.completed", "payment.failed", "invoice.paid", "invoice.overdue"];
  const toggle = (e: string) => setEvents((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ url, events }); }} className="space-y-4">
      <Input label="HTTPS URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/hooks/royalentry" required />
      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-600">Subscribe to events ({events.length})</label>
        <div className="flex flex-wrap gap-1.5">
          {ALL.map((e) => (
            <button key={e} type="button" onClick={() => toggle(e)}
              className={cn("rounded-md px-2 py-1 font-mono text-[10px] transition", events.includes(e) ? "bg-gold-500 text-navy-950" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
