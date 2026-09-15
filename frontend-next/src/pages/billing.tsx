"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Receipt, CalendarDays, TrendingUp, AlertTriangle,
  Smartphone, Loader2, Inbox, Infinity as InfinityIcon, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, StatCard, Modal, Input } from "@/components/ui";
import { formatTZS, formatDate, cn } from "@/lib/utils";

/* Local datetime formatter (DB timestamps are ISO strings) */
const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

const INVOICE_BADGE: Record<string, "green" | "blue" | "rose" | "slate"> = {
  paid: "green",
  open: "blue",
  overdue: "rose",
  void: "slate",
};

export default function BillingPage() {
  const qc = useQueryClient();
  const [payInvoice, setPayInvoice] = useState<any | null>(null);
  const [phone, setPhone] = useState("");

  /* ── Exact DB data ─────────────────────────────────────────────────────── */
  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: async () => (await api.get("/billing/subscription")).data.data,
  });

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: async () => (await api.get("/billing/invoices")).data.data,
  });

  /* Outstanding = sum of open + overdue invoices (computed from DB rows) */
  const list = (invoices ?? []) as any[];
  const outstanding = list
    .filter((i) => i.status === "open" || i.status === "overdue")
    .reduce((sum, i) => sum + (i.amount_tsh ?? 0), 0);

  const payMutation = useMutation({
    mutationFn: (payload: any) => api.post("/payments/mpesa/initiate", payload),
    onSuccess: (r: any) => {
      toast.success(r.data?.data?.message ?? "Payment request sent to your phone");
      setPayInvoice(null);
      setPhone("");
      qc.invalidateQueries({ queryKey: ["billing-invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Payment initiation failed"),
  });

  const handlePay = () => {
    if (!payInvoice) return;
    if (!phone || phone.trim().length < 10) {
      toast.error("Enter a valid M-Pesa phone number");
      return;
    }
    payMutation.mutate({
      package_name: payInvoice.plan_name ?? payInvoice.invoice_number,
      amount_tsh: payInvoice.amount_tsh,
      phone: phone.trim(),
    });
  };

  const loading = subLoading || invLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500">Your subscription, invoices and payments — live from your account</p>
      </div>

      {/* Outstanding banner (only when DB says there is debt) */}
      {outstanding > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Outstanding balance: {formatTZS(outstanding)}</p>
            <p className="mt-0.5 text-xs">Settle the open invoices below to keep your account active.</p>
          </div>
        </div>
      )}

      {/* ── Subscription summary — exact subscription row + plan row ─────── */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading subscription…
        </div>
      ) : sub ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Current Plan"
            value={sub.plan_name ?? "—"}
            icon={CreditCard}
            color="gold"
            subtitle={`${formatTZS(sub.price_tsh)} / ${sub.billing_interval}${sub.plan_code ? ` · ${sub.plan_code}` : ""}`}
          />
          <StatCard
            title="Status"
            value={sub.status ?? "—"}
            icon={TrendingUp}
            color={sub.status === "active" ? "green" : sub.status === "trialing" ? "blue" : "red"}
            subtitle={sub.trial_ends_at ? `Trial ends ${formatDate(sub.trial_ends_at)}` : undefined}
          />
          <StatCard
            title="Period Ends"
            value={formatDate(sub.current_period_end)}
            icon={CalendarDays}
            color="purple"
            subtitle={`Started ${formatDate(sub.current_period_start)}`}
          />
          <StatCard
            title="Package Limits"
            value={`${sub.max_events ?? "∞"} events`}
            icon={Receipt}
            color="blue"
            subtitle={`${sub.max_guests ?? "∞"} guests · ${sub.max_users ?? "∞"} users`}
          />
        </div>
      ) : (
        <Card>
          <div className="py-10 text-center">
            <CreditCard className="mx-auto mb-3 h-12 w-12 text-slate-200" />
            <h3 className="font-semibold text-slate-700">No active subscription</h3>
            <p className="mt-1 text-sm text-slate-500">Contact the platform admin to activate your package.</p>
          </div>
        </Card>
      )}

      {/* Extra subscription facts straight from the DB row */}
      {sub && (sub.cancel_at_period_end || sub.trial_ends_at) && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {sub.trial_ends_at && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-sky-800">
              <Clock className="h-3.5 w-3.5" /> Trial ends {formatDate(sub.trial_ends_at)}
            </span>
          )}
          {sub.cancel_at_period_end && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5" /> Cancels at period end ({formatDate(sub.current_period_end)})
            </span>
          )}
        </div>
      )}

      {/* ── Invoices — exact billing_invoices rows ────────────────────────── */}
      <Card title={`Invoices (${list.length})`}>
        {invLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
          </div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-slate-200" />
            <p className="font-medium text-slate-600">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {["Invoice #", "Plan", "Amount", "Status", "Issued", "Due", "Paid", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((inv) => (
                  <tr key={inv.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.plan_name ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatTZS(inv.amount_tsh)}</td>
                    <td className="px-4 py-3">
                      <Badge label={inv.status} variant={INVOICE_BADGE[inv.status] ?? "slate"} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDateTime(inv.issued_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{inv.due_at ? formatDate(inv.due_at) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{inv.paid_at ? fmtDateTime(inv.paid_at) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {(inv.status === "open" || inv.status === "overdue") && (
                        <button
                          onClick={() => setPayInvoice(inv)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          <Smartphone className="h-3.5 w-3.5" /> Pay with M-Pesa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* M-Pesa pay modal */}
      <Modal isOpen={!!payInvoice} onClose={() => { setPayInvoice(null); setPhone(""); }} title={`Pay ${payInvoice?.invoice_number ?? ""}`} size="sm">
        {payInvoice && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-400">Amount due</p>
              <p className="font-semibold text-slate-900">{formatTZS(payInvoice.amount_tsh)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {payInvoice.plan_name ?? "Subscription"} · due {payInvoice.due_at ? formatDate(payInvoice.due_at) : "—"}
              </p>
            </div>
            <Input label="M-Pesa phone number" placeholder="+2557xx xxx xxx" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            <p className="text-xs text-slate-500">You will receive an STK push on this phone. Enter your M-Pesa PIN to confirm.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setPayInvoice(null); setPhone(""); }}>Cancel</Button>
              <Button onClick={handlePay} isLoading={payMutation.isPending}>Send payment request</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
