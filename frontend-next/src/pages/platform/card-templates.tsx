"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette, Plus, Edit2, Trash2, Loader2, Upload, Download } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Textarea } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const DEFAULT_THEME = JSON.stringify({
  background: { mode: "gradient", solidColor: "#fef3c7", gradientStart: "#fbbf24", gradientEnd: "#92400e", gradientAngle: 135 },
  elements: [
    { type: "text", text: "{{event_title}}", x: 50, y: 100, width: 400, height: 50, fontSize: 32, fontFamily: "Georgia", fill: "#1e293b", fontStyle: "bold", align: "center" },
    { type: "text", text: "{{event_date}}", x: 100, y: 520, width: 300, height: 34, fontSize: 22, fontFamily: "Georgia", fill: "#78350f", align: "center" },
  ],
}, null, 2);

export default function CardTemplatesPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTpl, setEditTpl] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [themeJson, setThemeJson] = useState(DEFAULT_THEME);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["platform-card-templates"],
    queryFn: async () => (await api.get("/platform/card-templates")).data.data,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/platform/card-templates", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-card-templates"] }); setCreateOpen(false); toast.success("Template created"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/card-templates/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-card-templates"] }); setEditTpl(null); toast.success("Template updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/card-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-card-templates"] }); setDeleteConfirm(null); toast.success("Template deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  // Import templates from JSON file
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          await api.post("/platform/card-templates", {
            name: item.name ?? "Imported Template",
            description: item.description,
            theme_config: item.theme_config ?? item.themeConfig ?? {},
            preview_image_url: item.preview_image_url ?? item.previewImageUrl,
          });
        }
        qc.invalidateQueries({ queryKey: ["platform-card-templates"] });
        toast.success(`Imported ${items.length} template(s)`);
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  // Export all templates as JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `royalentry-card-templates-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Templates exported");
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    let config = {};
    try { config = JSON.parse(themeJson); }
    catch { toast.error("Invalid JSON in theme config"); return; }
    createMutation.mutate({
      name: (f.elements.namedItem("name") as HTMLInputElement).value,
      description: (f.elements.namedItem("description") as HTMLInputElement).value || undefined,
      theme_config: config,
      preview_image_url: (f.elements.namedItem("preview_image_url") as HTMLInputElement).value || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Card Templates</h1>
          <p className="text-sm text-slate-500">Global invitation design library — organizations select these when creating events</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Import</Button>
          <Button variant="ghost" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
          <Button onClick={() => { setThemeJson(DEFAULT_THEME); setCreateOpen(true); }}><Plus className="h-4 w-4" /> Create</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : templates.length === 0 ? (
        <Card><div className="py-12 text-center"><Palette className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No templates yet — create or import one</p></div></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t: any) => (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              {t.preview_image_url && <img src={t.preview_image_url} alt={t.name} className="mb-3 h-32 w-full rounded-lg object-cover" />}
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900">{t.name}</p>
                <Badge label={t.is_active ? "active" : "inactive"} variant={t.is_active ? "green" : "slate"} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{t.description ?? "—"}</p>
              <p className="mt-2 text-[10px] text-slate-400">Updated {formatDate(t.updated_at)}</p>
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditTpl(t)}><Edit2 className="h-4 w-4" /> Edit</Button>
                <Button variant="ghost" size="sm" className="flex-1 text-rose-600" onClick={() => setDeleteConfirm(t.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Card Template" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" name="name" required />
            <Input label="Preview Image URL" name="preview_image_url" placeholder="https://..." />
          </div>
          <Input label="Description" name="description" placeholder="Describe the design style" />
          <Textarea label="Theme Config (JSON)" name="theme_config" rows={12} value={themeJson} onChange={(e: any) => setThemeJson(e.target.value)} className="font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editTpl} onClose={() => setEditTpl(null)} title="Edit Template" size="lg">
        {editTpl && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            updateMutation.mutate({
              id: editTpl.id,
              payload: {
                name: (f.elements.namedItem("name") as HTMLInputElement).value || undefined,
                description: (f.elements.namedItem("description") as HTMLInputElement).value || undefined,
                is_active: (f.elements.namedItem("is_active") as HTMLInputElement).checked,
              },
            });
          }} className="space-y-4">
            <Input label="Name" name="name" defaultValue={editTpl.name} />
            <Input label="Description" name="description" defaultValue={editTpl.description ?? ""} />
            <label className="flex items-center gap-3">
              <input type="checkbox" name="is_active" defaultChecked={editTpl.is_active} className="h-4 w-4 rounded accent-gold-500" />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditTpl(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Template" size="sm">
        <p className="text-sm text-slate-600">Delete this template? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}