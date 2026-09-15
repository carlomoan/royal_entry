"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Eye, Edit, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function CardTemplatesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["platform-card-templates"],
    queryFn: async () => (await api.get("/platform/card-templates")).data.data,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/platform/card-templates", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-card-templates"] }); setCreateOpen(false); toast.success("Template created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/card-templates/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-card-templates"] }); setEditTemplate(null); toast.success("Template updated"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/card-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-card-templates"] }); toast.success("Template deleted"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);
      return api.post(`/platform/card-templates/${id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-card-templates"] }); toast.success("Image uploaded"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Card Templates</h1>
          <p className="text-sm text-slate-500">Design invitation, check-in, and pledge card templates</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: any) => (
            <Card key={template.id} className="relative">
              <div className="absolute top-3 right-3">
                <Badge label={template.template_type} variant="blue" />
              </div>
              {template.image_url && (
                <img src={template.image_url} alt={template.name} className="w-full h-48 object-cover rounded-lg mb-3" />
              )}
              <h3 className="text-lg font-bold text-slate-900">{template.name}</h3>
              <p className="text-xs text-slate-500 mt-1">Created: {formatDate(template.created_at)}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(template)}>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditTemplate(template)}>
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => deleteMutation.mutate(template.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Card Template" size="lg">
        <form onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          createMutation.mutate({
            name: (f.elements.namedItem("name") as HTMLInputElement).value,
            template_type: (f.elements.namedItem("template_type") as HTMLSelectElement).value,
            placeholders: JSON.parse((f.elements.namedItem("placeholders") as HTMLTextAreaElement).value || "{}"),
            is_active: (f.elements.namedItem("is_active") as HTMLInputElement).checked,
          });
        }} className="space-y-4">
          <Input label="Template Name *" name="name" required />
          <Select label="Template Type *" name="template_type" required>
            <option value="invitation">Invitation Card</option>
            <option value="checkin">Check-in Card</option>
            <option value="pledge">Pledge Card</option>
          </Select>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Placeholders (JSON)</label>
            <textarea name="placeholders" rows={6} className="w-full rounded-lg border border-slate-200 p-3 font-mono text-sm" defaultValue='{"guest_name": "{{guest_name}}", "event_title": "{{event_title}}", "qr_code": "{{qr_code}}"}' />
            <p className="text-xs text-slate-500 mt-1">Define placeholders for dynamic data</p>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 rounded accent-gold-500" />
            <span className="text-sm text-slate-700">Active</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Template Modal */}
      <Modal isOpen={!!editTemplate} onClose={() => setEditTemplate(null)} title="Edit Template" size="lg">
        {editTemplate && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            updateMutation.mutate({
              id: editTemplate.id,
              payload: {
                name: (f.elements.namedItem("name") as HTMLInputElement).value,
                template_type: (f.elements.namedItem("template_type") as HTMLSelectElement).value,
                placeholders: JSON.parse((f.elements.namedItem("placeholders") as HTMLTextAreaElement).value || "{}"),
                is_active: (f.elements.namedItem("is_active") as HTMLInputElement).checked,
              },
            });
          }} className="space-y-4">
            <Input label="Template Name *" name="name" defaultValue={editTemplate.name} required />
            <Select label="Template Type *" name="template_type" defaultValue={editTemplate.template_type} required>
              <option value="invitation">Invitation Card</option>
              <option value="checkin">Check-in Card</option>
              <option value="pledge">Pledge Card</option>
            </Select>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Placeholders (JSON)</label>
              <textarea name="placeholders" rows={6} className="w-full rounded-lg border border-slate-200 p-3 font-mono text-sm" defaultValue={JSON.stringify(editTemplate.placeholders, null, 2)} />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="is_active" defaultChecked={editTemplate.is_active} className="h-4 w-4 rounded accent-gold-500" />
              <span className="text-sm text-slate-700">Active</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Upload Template Image</label>
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate({ id: editTemplate.id, file });
              }} className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy-950" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditTemplate(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={!!previewTemplate} onClose={() => setPreviewTemplate(null)} title="Template Preview" size="lg">
        {previewTemplate && (
          <div className="space-y-4">
            {previewTemplate.image_url && (
              <img src={previewTemplate.image_url} alt={previewTemplate.name} className="w-full rounded-lg" />
            )}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-900">{previewTemplate.name}</h4>
              <p className="text-sm text-slate-600">Type: {previewTemplate.template_type}</p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-700 mb-1">Placeholders:</p>
                <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                  {JSON.stringify(previewTemplate.placeholders, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
