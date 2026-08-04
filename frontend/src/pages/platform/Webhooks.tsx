// ==============================================================================
// FILE: src/pages/platform/Webhooks.tsx
// ==============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Globe,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import { platformApi, type CreateWebhookPayload, type UpdateWebhookPayload } from "@/api/platform";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { cn } from "@/utils/cn";

const EVENT_CATEGORIES = {
  Event: [
    "event.created",
    "event.updated",
    "event.deleted",
    "event.activated",
    "event.approved",
    "event.rejected",
  ],
  Guest: [
    "guest.created",
    "guest.updated",
    "guest.deleted",
    "guest.checked_in",
    "guest.rsvp_confirmed",
    "guest.rsvp_declined",
  ],
  Invitation: [
    "invitation.generated",
    "invitation.sent",
    "invitation.viewed",
    "invitation.scanned",
  ],
  Payment: [
    "payment.completed",
    "payment.failed",
    "payment.refunded",
  ],
  Michango: [
    "michango.pledge_created",
    "michango.payment_received",
    "michango.reminder_sent",
  ],
  Broadcast: [
    "broadcast.sent",
    "broadcast.delivered",
    "broadcast.failed",
  ],
  Organization: [
    "organization.created",
    "organization.approved",
    "organization.rejected",
    "organization.suspended",
  ],
  Subscription: [
    "subscription.created",
    "subscription.updated",
    "subscription.cancelled",
  ],
  Invoice: [
    "invoice.created",
    "invoice.paid",
    "invoice.overdue",
  ],
};


export default function Webhooks() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testWebhook, setTestWebhook] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["platform-webhooks"],
    queryFn: () => platformApi.listWebhooks(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateWebhookPayload) => platformApi.createWebhook(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-webhooks"] });
      toast.success("Webhook created");
      setCreateOpen(false);
      setSelectedEvents([]);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create webhook"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWebhookPayload }) =>
      platformApi.updateWebhook(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-webhooks"] });
      toast.success("Webhook updated");
      setEditWebhook(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update webhook"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteWebhook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-webhooks"] });
      toast.success("Webhook deleted");
      setDeleteConfirm(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete webhook"),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => platformApi.testWebhook(id),
    onSuccess: () => toast.success("Test event sent"),
    onError: (err: any) => toast.error(err?.message ?? "Failed to send test"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload: CreateWebhookPayload = {
      url: (form.elements.namedItem("url") as HTMLInputElement).value,
      events: selectedEvents,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editWebhook) return;
    const form = e.currentTarget;
    const payload: UpdateWebhookPayload = {
      url: (form.elements.namedItem("url") as HTMLInputElement).value || undefined,
      events: selectedEvents.length ? selectedEvents : undefined,
      is_active: (form.elements.namedItem("is_active") as HTMLInputElement).checked,
    };
    updateMutation.mutate({ id: editWebhook.id, payload });
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure HTTP callbacks for real-time event notifications.
          </p>
        </div>
        <Button onClick={() => { setSelectedEvents([]); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Create webhook
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading webhooks…</p>
      ) : webhooks.length === 0 ? (
        <div className="p-12 text-center">
          <Globe className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">No webhooks configured</p>
          <p className="text-xs text-slate-500 mt-1">
            Create your first webhook to start receiving real-time events.
          </p>
        </div>
      ) : (
        <Card title="Configured webhooks">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Webhooks list">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["URL", "Events", "Status", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {webhooks.map((w: any) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900 truncate max-w-[300px]">
                      {w.url}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.events.slice(0, 3).map((e: string) => (
                          <Badge key={e} label={e} variant="slate" />
                        ))}
                        {w.events.length > 3 && (
                          <Badge label={`+${w.events.length - 3} more`} variant="gold" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={w.is_active ? "Active" : "Inactive"}
                        variant={w.is_active ? "green" : "rose"}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTestWebhook(w.id)}
                          isLoading={testMutation.isPending && testWebhook === w.id}
                        >
                          <Send className="h-4 w-4" /> Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEvents(w.events);
                            setEditWebhook(w);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-800"
                          onClick={() => setDeleteConfirm(w.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Webhook Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setSelectedEvents([]); }}
        title="Create webhook"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="URL *"
            name="url"
            type="url"
            placeholder="https://your-app.com/webhook"
            required
          />
          <div>
            <label className="text-xs font-semibold text-slate-700">Events *</label>
            <p className="text-xs text-slate-500 mt-1">Select one or more events to subscribe to</p>
            <div className="mt-2 space-y-3">
              {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                <div key={category} className="border rounded-xl p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {events.map((event) => (
                      <label
                        key={event}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer",
                          selectedEvents.includes(event)
                            ? "border-gold-400 bg-gold-50 text-gold-800"
                            : "border-slate-200 text-slate-700 hover:border-gold-300"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event)}
                          onChange={() => toggleEvent(event)}
                          className="h-4 w-4 accent-gold-500"
                        />
                        <span className="font-mono text-xs">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setCreateOpen(false); setSelectedEvents([]); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create webhook"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Webhook Modal */}
      <Modal
        isOpen={!!editWebhook}
        onClose={() => { setEditWebhook(null); setSelectedEvents([]); }}
        title="Edit webhook"
        size="lg"
      >
        {editWebhook && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="URL"
              name="url"
              type="url"
              defaultValue={editWebhook.url}
            />
            <Input
              label="Secret (read-only)"
              name="secret"
              defaultValue={editWebhook.secret}
              disabled
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editWebhook.is_active}
                className="h-4 w-4 rounded accent-gold-500"
              />
              <label className="text-sm font-medium text-slate-700">Active</label>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Events</label>
              <p className="text-xs text-slate-500 mt-1">Select events to subscribe to</p>
              <div className="mt-2 space-y-3">
                {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                  <div key={category} className="border rounded-xl p-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                      {category}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {events.map((event) => (
                        <label
                          key={event}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer",
                            selectedEvents.includes(event)
                              ? "border-gold-400 bg-gold-50 text-gold-800"
                              : "border-slate-200 text-slate-700 hover:border-gold-300"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(event)}
                            onChange={() => toggleEvent(event)}
                            className="h-4 w-4 accent-gold-500"
                          />
                          <span className="font-mono text-xs">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => { setEditWebhook(null); setSelectedEvents([]); }}>
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
        title="Delete webhook"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this webhook? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="rose" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* Test Webhook Modal */}
      <Modal
        isOpen={!!testWebhook}
        onClose={() => setTestWebhook(null)}
        title="Test webhook"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Send a test event to verify the webhook is working correctly.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setTestWebhook(null)}>Cancel</Button>
          <Button onClick={() => { testMutation.mutate(testWebhook!); setTestWebhook(null); }} isLoading={testMutation.isPending}>
            Send test
          </Button>
        </div>
      </Modal>
    </div>
  );
}