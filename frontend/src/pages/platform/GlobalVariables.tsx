// ==============================================================================
// FILE: src/pages/platform/GlobalVariables.tsx
// ==============================================================================
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Variable,
  Plus,
  Edit2,
  Trash2,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { platformApi } from "@/api/platform";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import { formatDateTime } from "@/utils/format";

interface GlobalVariable {
  id: string;
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export default function GlobalVariables() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editVar, setEditVar] = useState<GlobalVariable | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: variables = [], isLoading } = useQuery({
    queryKey: ["platform-global-variables"],
    queryFn: () => platformApi.listGlobalVariables(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { key: string; value: string; description?: string }) =>
      platformApi.createGlobalVariable(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-global-variables"] });
      toast.success("Variable created");
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create variable"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { value: string; description?: string } }) =>
      platformApi.updateGlobalVariable(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-global-variables"] });
      toast.success("Variable updated");
      setEditVar(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update variable"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteGlobalVariable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-global-variables"] });
      toast.success("Variable deleted");
      setDeleteConfirm(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete variable"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      key: (form.elements.namedItem("key") as HTMLInputElement).value,
      value: (form.elements.namedItem("value") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value || undefined,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editVar) return;
    const form = e.currentTarget;
    const payload = {
      value: (form.elements.namedItem("value") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value || undefined,
    };
    updateMutation.mutate({ id: editVar.id, payload });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Global variables</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage reusable configuration values available across the platform.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add variable
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading variables…
        </div>
      ) : variables.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Variable className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">No global variables</p>
          <p className="text-xs text-slate-500 mt-1">
            Add reusable configuration values for use across the platform
          </p>
        </div>
      ) : (
        <Card title={`${variables.length} variable(s)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Global variables">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Key", "Value", "Description", "Updated", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variables.map((v: GlobalVariable) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono font-semibold text-gold-700 bg-gold-50 px-2 py-1 rounded">
                        {v.key}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-gray-800 max-w-[200px] block truncate">
                        {v.value}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {v.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(v.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditVar(v)}
                          className="p-1.5 rounded-lg text-gold-700 hover:bg-gold-50"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(v.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Variable Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add variable" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Key" name="key" placeholder="e.g. max_upload_size_mb" required />
          <Input label="Value" name="value" placeholder="e.g. 50" required />
          <Textarea
            label="Description (optional)"
            name="description"
            placeholder="What is this variable used for?"
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create variable"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Variable Modal */}
      <Modal isOpen={!!editVar} onClose={() => setEditVar(null)} title="Edit variable" size="md">
        {editVar && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Key</p>
              <p className="text-sm font-mono font-semibold text-gold-700 mt-1">{editVar.key}</p>
            </div>
            <Input label="Value" name="value" defaultValue={editVar.value} required />
            <Textarea
              label="Description (optional)"
              name="description"
              defaultValue={editVar.description ?? ""}
              rows={2}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditVar(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete variable" size="sm">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this global variable? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="rose" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}