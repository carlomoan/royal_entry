"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Modal, Input } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function GlobalVariablesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editVar, setEditVar] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: vars = [], isLoading } = useQuery({
    queryKey: ["platform-global-variables"],
    queryFn: async () => (await api.get("/platform/global-variables")).data.data,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/platform/global-variables", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-global-variables"] }); setCreateOpen(false); toast.success("Variable created"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/global-variables/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-global-variables"] }); setEditVar(null); toast.success("Variable updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/global-variables/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-global-variables"] }); setDeleteConfirm(null); toast.success("Variable deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    createMutation.mutate({
      key: (f.elements.namedItem("key") as HTMLInputElement).value,
      value: (f.elements.namedItem("value") as HTMLInputElement).value,
      description: (f.elements.namedItem("description") as HTMLInputElement).value || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editVar) return;
    const f = e.currentTarget;
    updateMutation.mutate({
      id: editVar.id,
      payload: {
        value: (f.elements.namedItem("value") as HTMLInputElement).value || undefined,
        description: (f.elements.namedItem("description") as HTMLInputElement).value || undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Global Variables</h1>
          <p className="text-sm text-slate-500">System-wide configuration variables</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add variable</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : vars.length === 0 ? (
        <Card><div className="py-12 text-center"><SlidersHorizontal className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No variables yet</p></div></Card>
      ) : (
        <Card title="Configuration Variables">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Key", "Value", "Description", "Updated", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vars.map((v: any) => (
                  <tr key={v.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{v.key}</td>
                    <td className="px-4 py-3 text-slate-600">{v.value}</td>
                    <td className="px-4 py-3 text-slate-500">{v.description ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDate(v.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditVar(v)} className="rounded p-1 text-gold-700 hover:bg-gold-50"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteConfirm(v.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
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
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Variable" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Key" name="key" placeholder="e.g. CURRENCY_SYMBOL" required />
          <Input label="Value" name="value" placeholder="e.g. TZS" required />
          <Input label="Description" name="description" placeholder="What this variable controls" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editVar} onClose={() => setEditVar(null)} title="Edit Variable" size="lg">
        {editVar && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Key" value={editVar.key} disabled />
            <Input label="Value" name="value" defaultValue={editVar.value} required />
            <Input label="Description" name="description" defaultValue={editVar.description ?? ""} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditVar(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Variable" size="sm">
        <p className="text-sm text-slate-600">Delete this variable? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}