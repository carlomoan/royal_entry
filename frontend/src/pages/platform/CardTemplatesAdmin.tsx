// ==============================================================================
// FILE: src/pages/platform/CardTemplatesAdmin.tsx
// ==============================================================================
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Palette,
  Plus,
  Edit2,
  Trash2,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { platformApi } from "@/api/platform";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import { formatDateTime } from "@/utils/format";

interface CardTemplate {
  id: string;
  name: string;
  description?: string;
  theme_config: Record<string, unknown>;
  preview_image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_THEME_CONFIG = JSON.stringify(
  {
    primary_color: "#c9a84c",
    secondary_color: "#1a2647",
    font_family: "serif",
    background_style: "gradient",
    border_style: "rounded",
    show_logo: true,
  },
  null,
  2,
);

export default function CardTemplatesAdmin() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<CardTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewConfig, setPreviewConfig] = useState<string>(DEFAULT_THEME_CONFIG);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["platform-card-templates"],
    queryFn: () => platformApi.listCardTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      theme_config: Record<string, unknown>;
      preview_image_url?: string;
    }) => platformApi.createCardTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-card-templates"] });
      toast.success("Template created");
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create template"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        name?: string;
        description?: string;
        theme_config?: Record<string, unknown>;
        preview_image_url?: string;
        is_active?: boolean;
      };
    }) => platformApi.updateCardTemplate(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-card-templates"] });
      toast.success("Template updated");
      setEditTemplate(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteCardTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-card-templates"] });
      toast.success("Template deleted");
      setDeleteConfirm(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete template"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    let themeConfig: Record<string, unknown>;
    try {
      themeConfig = JSON.parse(previewConfig);
    } catch {
      toast.error("Invalid JSON in theme configuration");
      return;
    }
    const payload = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value || undefined,
      theme_config: themeConfig,
      preview_image_url: (form.elements.namedItem("preview_image_url") as HTMLInputElement).value || undefined,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTemplate) return;
    const form = e.currentTarget;
    const payload: {
      name?: string;
      description?: string;
      theme_config?: Record<string, unknown>;
      preview_image_url?: string;
      is_active?: boolean;
    } = {};
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    if (name) payload.name = name;
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
    if (description) payload.description = description;
    const previewImageUrl = (form.elements.namedItem("preview_image_url") as HTMLInputElement).value;
    if (previewImageUrl) payload.preview_image_url = previewImageUrl;
    payload.is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;

    // Parse theme config from the editor
    try {
      const themeConfigRaw = (form.elements.namedItem("theme_config") as HTMLTextAreaElement).value;
      payload.theme_config = JSON.parse(themeConfigRaw);
    } catch {
      toast.error("Invalid JSON in theme configuration");
      return;
    }

    updateMutation.mutate({ id: editTemplate.id, payload });
  };

  const openEdit = (tpl: CardTemplate) => {
    setEditTemplate(tpl);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Card templates</h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and manage global invitation card templates for all organizations.
          </p>
        </div>
        <Button onClick={() => { setPreviewConfig(DEFAULT_THEME_CONFIG); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Create template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Palette className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">No card templates</p>
          <p className="text-xs text-slate-500 mt-1">
            Create global invitation design templates for your organizations
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((tpl: CardTemplate) => (
            <div
              key={tpl.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">{tpl.name}</p>
                <Badge label={tpl.is_active ? "active" : "inactive"} variant={tpl.is_active ? "green" : "slate"} />
              </div>
              {tpl.description && (
                <p className="text-xs text-slate-500 line-clamp-2">{tpl.description}</p>
              )}
              {tpl.preview_image_url && (
                <img
                  src={tpl.preview_image_url}
                  alt={tpl.name}
                  className="w-full h-32 object-cover rounded-xl border border-slate-100"
                />
              )}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Updated {formatDateTime(tpl.updated_at)}</span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(tpl)}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-rose-600 hover:bg-rose-50"
                  onClick={() => setDeleteConfirm(tpl.id)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create card template" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Template name" name="name" placeholder="Elegant Gold" required />
          <Textarea
            label="Description (optional)"
            name="description"
            placeholder="Describe the design and when to use it"
            rows={2}
          />
          <Input
            label="Preview image URL (optional)"
            name="preview_image_url"
            placeholder="https://example.com/preview.png"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Theme configuration (JSON)
            </label>
            <textarea
              name="theme_config"
              value={previewConfig}
              onChange={(e) => setPreviewConfig(e.target.value)}
              rows={8}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white placeholder:text-gray-400 outline-none transition-all focus:ring-2 focus:ring-gold-400 focus:border-transparent border-gray-300"
            />
            <p className="text-xs text-slate-500 mt-1">
              Define the theming properties as valid JSON
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create template"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Template Modal */}
      <Modal isOpen={!!editTemplate} onClose={() => setEditTemplate(null)} title="Edit card template" size="lg">
        {editTemplate && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Template name" name="name" defaultValue={editTemplate.name} />
            <Textarea
              label="Description (optional)"
              name="description"
              defaultValue={editTemplate.description ?? ""}
              rows={2}
            />
            <Input
              label="Preview image URL (optional)"
              name="preview_image_url"
              defaultValue={editTemplate.preview_image_url ?? ""}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Theme configuration (JSON)
              </label>
              <textarea
                name="theme_config"
                defaultValue={JSON.stringify(editTemplate.theme_config, null, 2)}
                rows={8}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-gray-900 bg-white placeholder:text-gray-400 outline-none transition-all focus:ring-2 focus:ring-gold-400 focus:border-transparent border-gray-300"
              />
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editTemplate.is_active}
                className="h-4 w-4 rounded accent-gold-500"
              />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditTemplate(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete template"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this card template? This action cannot be undone.
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