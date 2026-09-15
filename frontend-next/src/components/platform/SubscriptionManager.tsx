"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileText, RefreshCw, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Badge, Button, Card, Input, Modal, Select } from "@/components/ui";
import { formatDate, formatTZS, cn } from "@/lib/utils";

export function SubscriptionManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [subOpen, setSubOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);

  // ✅ Send Modal States
  const [sendInvoice, setSendInvoice] = useState<any | null>(null);
  const [sendChannels, setSendChannels] = useState<string[]>(["email"]);

  const { data: plans = [] } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => (await api.get("/platform/plans")).data.data,
  });
  const { data: detail } = useQuery({
    queryKey: ["account-profile", orgId],
    queryFn: async () => (await api.get(`/platform/customers/${orgId}`)).data.data,
    enabled: !!orgId,
  });

  const sub = detail?.current_subscription;
  const invoices: any[] = detail?.recent_invoices ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["account-profile", orgId] });
    qc.invalidateQueries({ queryKey: ["platform-customers"] });
    qc.invalidateQueries({ queryKey: ["platform-summary"] });
  };

  const subMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/platform/customers/${orgId}/subscription`, payload),
    onSuccess: () => { invalidate(); setSubOpen(false); toast.success("Subscription updated"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const invMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/platform/customers/${orgId}/invoices`, payload),
    onSuccess: () => { invalidate(); setInvOpen(false); toast.success("Invoice created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  // ✅ Updated Send Mutation to accept Channels Payload
  const sendMutation = useMutation({
    mutationFn: ({ id, channels }: { id: string; channels: string[] }) =>
      api.post(`/platform/invoices/${id}/send`, { channels }),
    onSuccess: () => {
      toast.success("Invoice delivery queued via selected channels");
      setSendInvoice(null);
      setSendChannels(["email"]);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to send invoice"),
  });

  const paidMutation = useMutation({
    mutationFn: async ({ id, payload, planId }: { id: string; payload: any; planId?: string }) => {
      await api.post(`/platform/invoices/${id}/mark-paid`, payload);
      if (planId) {
        await api.put(`/platform/customers/${orgId}/subscription`, {
          plan_id: planId, status: "active", create_invoice: false,
        });
      }
    },
    onSuccess: () => { invalidate(); setMarkPaidId(null); toast.success("Payment confirmed — account activated"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const markPaidInvoice = invoices.find((i) => i.id === markPaidId);

  return (
    <>
      <Card
        title="Subscription & Billing"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setInvOpen(true)}>
              <FileText className="h-3.5 w-3.5" /> New invoice
            </Button>
            <Button size="sm" onClick={() => setSubOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Assign / change plan
            </Button>
          </div>
        }
      >
        {sub ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Plan" value={sub.plan_name} />
            <Fact label="Status" value={<Badge label={sub.status} variant={sub.status === "active" ? "green" : sub.status === "trialing" ? "blue" : "rose"} />} />
            <Fact label="Price" value={formatTZS(sub.price_tsh)} />
            <Fact label="Period end" value={formatDate(sub.current_period_end)} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">
            No subscription yet — assign a package to activate this account.
          </p>
        )}

        {invoices.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Invoice #", "Amount", "Status", "Due", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-900">{inv.invoice_number}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{formatTZS(inv.amount_tsh)}</td>
                    <td className="px-3 py-2"><Badge label={inv.status} /></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDate(inv.due_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        {(inv.status === "open" || inv.status === "overdue") && (
                          <>
                            {/* ✅ Opens Send Modal instead of direct API call */}
                            <Button size="sm" variant="outline" onClick={() => setSendInvoice(inv)}>
                              <Send className="h-3.5 w-3.5" /> Send
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setMarkPaidId(inv.id)}>
                              <BadgeCheck className="h-3.5 w-3.5" /> Confirm payment
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assign / change plan */}
      <Modal isOpen={subOpen} onClose={() => setSubOpen(false)} title="Assign / Change Package" size="md">
        <form onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          subMutation.mutate({
            plan_id: (f.elements.namedItem("plan_id") as HTMLSelectElement).value,
            status: (f.elements.namedItem("status") as HTMLSelectElement).value,
            create_invoice: (f.elements.namedItem("create_invoice") as HTMLInputElement).checked,
            due_in_days: parseInt((f.elements.namedItem("due_in_days") as HTMLInputElement).value || "7", 10),
          });
        }} className="space-y-4">
          <Select label="Package plan" name="plan_id" defaultValue={sub?.plan_id ?? ""}>
            <option value="">— Select package —</option>
            {(plans as any[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatTZS(p.price_tsh)} / {p.billing_interval}
                {p.max_events != null ? ` · ${p.max_events} event(s)` : ""}
                {p.max_guests != null ? ` · ${p.max_guests} guests` : ""}
              </option>
            ))}
          </Select>
          <Select label="Status" name="status" defaultValue={sub?.status ?? "trialing"}>
            {["trialing", "active", "past_due", "cancelled", "expired"].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Invoice due in (days)" name="due_in_days" type="number" defaultValue={7} />
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="create_invoice" defaultChecked className="h-4 w-4 rounded accent-gold-500" />
              Create first invoice
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setSubOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={subMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Create invoice */}
      <Modal isOpen={invOpen} onClose={() => setInvOpen(false)} title="Create Invoice" size="md">
        <form onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          invMutation.mutate({
            plan_id: (f.elements.namedItem("plan_id") as HTMLSelectElement).value || undefined,
            due_in_days: parseInt((f.elements.namedItem("due_in_days") as HTMLInputElement).value || "7", 10),
            notes: (f.elements.namedItem("notes") as HTMLInputElement).value || undefined,
          });
        }} className="space-y-4">
          <Select label="Plan (defaults to current)" name="plan_id">
            <option value="">Current plan</option>
            {(plans as any[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="Due in (days)" name="due_in_days" type="number" defaultValue={7} />
          <Input label="Notes" name="notes" placeholder="Optional notes" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setInvOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={invMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Confirm payment & activate */}
      <Modal isOpen={!!markPaidId} onClose={() => setMarkPaidId(null)} title="Confirm Payment & Activate" size="md">
        <form onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          paidMutation.mutate({
            id: markPaidId!,
            planId: markPaidInvoice?.plan_id ?? sub?.plan_id,
            payload: {
              payment_method: (f.elements.namedItem("payment_method") as HTMLSelectElement).value,
              payer_phone: (f.elements.namedItem("payer_phone") as HTMLInputElement).value || undefined,
              notes: (f.elements.namedItem("notes") as HTMLInputElement).value || undefined,
            },
          });
        }} className="space-y-4">
          <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
            Confirming payment marks the invoice paid, records the payment, and <strong>activates the package</strong> for this account.
          </p>
          <Select label="Payment method" name="payment_method" defaultValue="mpesa">
            {["mpesa", "tigo_pesa", "airtel_money", "bank_transfer", "cash", "manual"].map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
          </Select>
          <Input label="Payer phone / reference" name="payer_phone" placeholder="+2557…" />
          <Input label="Notes" name="notes" placeholder="Receipt / reference" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setMarkPaidId(null)}>Cancel</Button>
            <Button type="submit" isLoading={paidMutation.isPending}>Confirm & activate</Button>
          </div>
        </form>
      </Modal>

      {/* ✅ Send Invoice Channels Modal */}
      <Modal isOpen={!!sendInvoice} onClose={() => setSendInvoice(null)} title="Send Invoice" size="md">
        {sendInvoice && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Select delivery channels for invoice <strong>{sendInvoice.invoice_number}</strong> ({formatTZS(sendInvoice.amount_tsh)}).
            </p>
            <div className="grid grid-cols-2 gap-3">
              {["email", "whatsapp", "telegram", "sms"].map((ch) => (
                <label
                  key={ch}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition",
                    sendChannels.includes(ch)
                      ? "border-gold-400 bg-gold-50 ring-1 ring-gold-400"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={sendChannels.includes(ch)}
                    onChange={(e) => {
                      if (e.target.checked) setSendChannels((prev) => [...prev, ch]);
                      else setSendChannels((prev) => prev.filter((c) => c !== ch));
                    }}
                    className="h-4 w-4 rounded accent-gold-500"
                  />
                  <span className="text-sm font-medium text-slate-700 capitalize">{ch}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setSendInvoice(null)}>Cancel</Button>
              <Button
                onClick={() => sendMutation.mutate({ id: sendInvoice.id, channels: sendChannels })}
                isLoading={sendMutation.isPending}
                disabled={sendChannels.length === 0}
              >
                <Send className="h-4 w-4" /> Deliver Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
