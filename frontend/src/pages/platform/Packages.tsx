// ==============================================================================
// FILE: src/pages/platform/Packages.tsx
// ==============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Palette, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { platformApi, type CreatePlanPayload, type UpdatePlanPayload } from "@/api/platform";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { formatTZS } from "@/utils/format";

export default function Packages() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformApi.plans(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePlanPayload) => platformApi.createPlan(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
      toast.success("Plan created");
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create plan"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePlanPayload }) =>
      platformApi.updatePlan(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
      toast.success("Plan updated");
      setEditPlan(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update plan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.deletePlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
      toast.success("Plan deleted");
      setDeleteConfirm(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete plan"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload: CreatePlanPayload = {
      code: (form.elements.namedItem("code") as HTMLInputElement).value,
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value || undefined,
      price_tsh: parseInt((form.elements.namedItem("price_tsh") as HTMLInputElement).value, 10),
      billing_interval: (form.elements.namedItem("billing_interval") as HTMLSelectElement).value,
      max_users: (form.elements.namedItem("max_users") as HTMLInputElement).value
        ? parseInt((form.elements.namedItem("max_users") as HTMLInputElement).value, 10)
        : undefined,
      max_events: (form.elements.namedItem("max_events") as HTMLInputElement).value
        ? parseInt((form.elements.namedItem("max_events") as HTMLInputElement).value, 10)
        : undefined,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editPlan) return;
    const form = e.currentTarget;
    const payload: UpdatePlanPayload = {};
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    if (name) payload.name = name;
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
    if (description) payload.description = description;
    const priceRaw = (form.elements.namedItem("price_tsh") as HTMLInputElement).value;
    if (priceRaw) payload.price_tsh = parseInt(priceRaw, 10);
    const interval = (form.elements.namedItem("billing_interval") as HTMLSelectElement).value;
    if (interval) payload.billing_interval = interval;
    const maxUsersRaw = (form.elements.namedItem("max_users") as HTMLInputElement).value;
    if (maxUsersRaw) {
      payload.max_users = parseInt(maxUsersRaw, 10);
    } else {
      payload.max_users = null;
    }
    const maxEventsRaw = (form.elements.namedItem("max_events") as HTMLInputElement).value;
    if (maxEventsRaw) {
      payload.max_events = parseInt(maxEventsRaw, 10);
    } else {
      payload.max_events = null;
    }
    payload.is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
    updateMutation.mutate({ id: editPlan.id, payload });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <p className="text-sm text-slate-600 mt-1">
            Service plans & feature limits for customer organizations.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create plan
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading plans…</p>
      ) : plans.length === 0 ? (
        <div className="p-12 text-center">
          <Palette className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">No plans configured</p>
          <p className="text-xs text-slate-500 mt-1">Create your first plan to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                <Badge label={plan.billing_interval} />
              </div>
              <p className="text-2xl font-black text-gold-600">
                {formatTZS(plan.price_tsh)}
              </p>
              <p className="text-xs text-gray-500">{plan.description ?? "—"}</p>
              <div className="mt-1 flex gap-3 text-xs text-gray-500">
                <span>{plan.max_users == null ? "Unlimited" : `${plan.max_users}`} users</span>
                <span>{plan.max_events == null ? "Unlimited" : `${plan.max_events}`} events</span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditPlan(plan)}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-rose-600 hover:bg-rose-50"
                  onClick={() => setDeleteConfirm(plan.id)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Plan Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create plan" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Code" name="code" placeholder="starter" required />
            <Input label="Name" name="name" placeholder="Starter Plan" required />
          </div>
          <Textarea
            label="Description"
            name="description"
            placeholder="Plan description"
            rows={2}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Price (TZS)" name="price_tsh" type="number" placeholder="50000" required />
            <Select
              label="Billing interval"
              name="billing_interval"
              required
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Max users (optional)" name="max_users" type="number" placeholder="10" />
            <Input label="Max events (optional)" name="max_events" type="number" placeholder="5" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create plan"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Plan Modal */}
      <Modal isOpen={!!editPlan} onClose={() => setEditPlan(null)} title="Edit plan" size="lg">
        {editPlan && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Name" name="name" defaultValue={editPlan.name} />
            <Textarea
              label="Description"
              name="description"
              defaultValue={editPlan.description ?? ""}
              rows={2}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Price (TZS)" name="price_tsh" type="number" defaultValue={editPlan.price_tsh} />
              <Select
                label="Billing interval"
                name="billing_interval"
                defaultValue={editPlan.billing_interval}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Max users" name="max_users" type="number" defaultValue={editPlan.max_users ?? ""} />
              <Input label="Max events" name="max_events" type="number" defaultValue={editPlan.max_events ?? ""} />
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editPlan.is_active}
                className="h-4 w-4 rounded accent-gold-500"
              />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditPlan(null)}>
                Cancel
              </Button>
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
        title="Delete plan"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this plan? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="rose" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}