"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Edit2, Trash2, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Select } from "@/components/ui";
import { formatTZS } from "@/lib/utils";
import { cn } from "@/lib/utils";

const FEATURES = [
  { key: "events", label: "Events" },
  { key: "guests", label: "Guests" },
  { key: "invitations", label: "Invitations" },
  { key: "scanner", label: "Scanner" },
  { key: "michango", label: "Michango" },
  { key: "broadcast", label: "Broadcast" },
  { key: "payments", label: "Payments" },
  { key: "reports", label: "Reports" },
  { key: "audit", label: "Audit" },
  { key: "team", label: "Team" },
  { key: "settings", label: "Settings" },
  { key: "cards", label: "Cards" },
  { key: "webhooks", label: "Webhooks" },
  { key: "api", label: "API" },
];

// Sensible defaults for a brand-new plan.
function defaultFeatures(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  FEATURES.forEach((f) => (map[f.key] = !["webhooks", "api"].includes(f.key)));
  return map;
}

// Merge a plan's stored features (JSON object of booleans) over the defaults.
function featuresFromPlan(features?: Record<string, boolean>): Record<string, boolean> {
  const base = defaultFeatures();
  if (features) {
    Object.entries(features).forEach(([k, v]) => { if (k in base) base[k] = v; });
  }
  return base;
}

export default function PackagesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>(defaultFeatures());

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => (await api.get("/platform/plans")).data.data,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/platform/plans", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-plans"] }); setCreateOpen(false); toast.success("Plan created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/plans/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-plans"] }); setEditPlan(null); toast.success("Plan updated"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-plans"] }); setDeleteConfirm(null); toast.success("Plan deleted"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed"),
  });

  const toggleFeature = (key: string) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    createMutation.mutate({
      code: (f.elements.namedItem("code") as HTMLInputElement).value.trim().toLowerCase().replace(/\s+/g, "_"),
      name: (f.elements.namedItem("name") as HTMLInputElement).value,
      description: (f.elements.namedItem("description") as HTMLInputElement).value || undefined,
      price_tsh: parseInt((f.elements.namedItem("price_tsh") as HTMLInputElement).value, 10),
      billing_interval: (f.elements.namedItem("billing_interval") as HTMLSelectElement).value,
      max_users: (f.elements.namedItem("max_users") as HTMLInputElement).value ? parseInt((f.elements.namedItem("max_users") as HTMLInputElement).value, 10) : null,
      max_events: (f.elements.namedItem("max_events") as HTMLInputElement).value ? parseInt((f.elements.namedItem("max_events") as HTMLInputElement).value, 10) : null,
      max_guests: (f.elements.namedItem("max_guests") as HTMLInputElement).value ? parseInt((f.elements.namedItem("max_guests") as HTMLInputElement).value, 10) : null,
      features,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editPlan) return;
    const f = e.currentTarget;
    const payload: any = {
      features,
      max_users: (f.elements.namedItem("max_users") as HTMLInputElement).value ? parseInt((f.elements.namedItem("max_users") as HTMLInputElement).value, 10) : null,
      max_events: (f.elements.namedItem("max_events") as HTMLInputElement).value ? parseInt((f.elements.namedItem("max_events") as HTMLInputElement).value, 10) : null,
      max_guests: (f.elements.namedItem("max_guests") as HTMLInputElement).value ? parseInt((f.elements.namedItem("max_guests") as HTMLInputElement).value, 10) : null,
    };
    const name = (f.elements.namedItem("name") as HTMLInputElement).value;
    const desc = (f.elements.namedItem("description") as HTMLInputElement).value;
    const price = (f.elements.namedItem("price_tsh") as HTMLInputElement).value;
    const interval = (f.elements.namedItem("billing_interval") as HTMLSelectElement).value;
    if (name) payload.name = name;
    if (desc) payload.description = desc;
    if (price) payload.price_tsh = parseInt(price, 10);
    if (interval) payload.billing_interval = interval;
    updateMutation.mutate({ id: editPlan.id, payload });
  };

  const enabledCount = (p: any) => Object.values(featuresFromPlan(p.features)).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Packages</h1>
          <p className="text-sm text-slate-500">Service plans, feature limits & access assignment</p>
        </div>
        <Button onClick={() => { setFeatures(defaultFeatures()); setCreateOpen(true); }}><Plus className="h-4 w-4" /> Create plan</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : plans.length === 0 ? (
        <Card><div className="py-12 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No plans configured</p></div></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan: any) => (
            <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900">{plan.name}</p>
                <Badge label={plan.billing_interval} variant="gold" />
              </div>
              <p className="mt-2 text-2xl font-black text-gold-600">{formatTZS(plan.price_tsh)}</p>
              <p className="mt-1 text-xs text-slate-500">{plan.description ?? "—"}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-0.5">{plan.max_users == null ? "Unlimited" : plan.max_users} users</span>
                <span className="rounded bg-slate-100 px-2 py-0.5">{plan.max_events == null ? "Unlimited" : plan.max_events} events</span>
                <span className="rounded bg-slate-100 px-2 py-0.5">{plan.max_guests == null ? "Unlimited" : plan.max_guests} guests</span>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-600">{enabledCount(plan)}/{FEATURES.length} features enabled</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {FEATURES.filter((f) => featuresFromPlan(plan.features)[f.key]).map((f) => (
                  <span key={f.key} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{f.label}</span>
                ))}
              </div>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => { setEditPlan(plan); setFeatures(featuresFromPlan(plan.features)); }}><Edit2 className="h-4 w-4" /> Edit</Button>
                <Button variant="ghost" size="sm" className="flex-1 text-rose-600" onClick={() => setDeleteConfirm(plan.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Plan" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code" name="code" required />
            <Input label="Name" name="name" required />
          </div>
          <Input label="Description" name="description" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price (TZS)" name="price_tsh" type="number" required />
            <Select label="Billing Interval" name="billing_interval" defaultValue="monthly">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Max Users" name="max_users" type="number" />
            <Input label="Max Events" name="max_events" type="number" />
            <Input label="Max Guests" name="max_guests" type="number" />
          </div>
          <FeaturePicker features={FEATURES} value={features} onToggle={toggleFeature} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editPlan} onClose={() => setEditPlan(null)} title="Edit Plan" size="lg">
        {editPlan && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Name" name="name" defaultValue={editPlan.name} />
            <Input label="Description" name="description" defaultValue={editPlan.description ?? ""} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Price (TZS)" name="price_tsh" type="number" defaultValue={editPlan.price_tsh} />
              <Select label="Billing Interval" name="billing_interval" defaultValue={editPlan.billing_interval}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Max Users" name="max_users" type="number" defaultValue={editPlan.max_users ?? ""} />
              <Input label="Max Events" name="max_events" type="number" defaultValue={editPlan.max_events ?? ""} />
              <Input label="Max Guests" name="max_guests" type="number" defaultValue={editPlan.max_guests ?? ""} />
            </div>
            <FeaturePicker features={FEATURES} value={features} onToggle={toggleFeature} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditPlan(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Plan" size="sm">
        <p className="text-sm text-slate-600">Delete this plan? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function FeaturePicker({ features, value, onToggle }: { features: { key: string; label: string }[]; value: Record<string, boolean>; onToggle: (k: string) => void }) {
  const count = Object.values(value).filter(Boolean).length;
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
        <Package className="h-3.5 w-3.5" /> Feature Access ({count}/{features.length} enabled)
      </label>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
        {features.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onToggle(f.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition",
              value[f.key] ? "bg-navy-950 text-gold-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {value[f.key] && <Check className="h-3 w-3" />}
            {f.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        These features define what an account on this plan can access (enforced by the backend).
      </p>
    </div>
  );
}