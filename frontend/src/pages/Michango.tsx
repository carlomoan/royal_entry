// ==============================================================================
// FILE: src/pages/Michango.tsx
// ==============================================================================

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  Bell,
  Clock3,
  MessageCircleMore,
  Plus,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { michangoApi } from "@/api/michango";
import { guestsApi } from "@/api/guests";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import StatCard from "@/components/ui/StatCard";
import { formatTZS, formatDate, formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

export default function Michango() {
  const { id: eventId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [showAddPledge, setShowAddPledge] = useState(false);
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [selectedGuest, setSelectedGuest] = useState("");
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");

  const { data: pledges = [], isLoading } = useQuery({
    queryKey: ["michango", eventId, statusFilter],
    queryFn: () => michangoApi.list(eventId!, statusFilter || undefined),
    enabled: !!eventId,
  });

  const { data: summary } = useQuery({
    queryKey: ["michango-summary", eventId],
    queryFn: () => michangoApi.summary(eventId!),
    enabled: !!eventId,
  });

  const { data: reminderHistory = [] } = useQuery({
    queryKey: ["michango-reminders", eventId],
    queryFn: () => michangoApi.reminderHistory(eventId!),
    enabled: !!eventId,
  });

  const { data: guestsData } = useQuery({
    queryKey: ["guests-all", eventId],
    queryFn: () => guestsApi.list(eventId!, 1, 500),
    enabled: !!eventId,
  });

  const allGuests = guestsData?.data ?? [];
  const pledgedIds = new Set(pledges.map((p) => p.guest_id));
  const availableGuests = allGuests.filter((g) => !pledgedIds.has(g.id));

  const addPledgeMutation = useMutation({
    mutationFn: () =>
      michangoApi.addPledge(eventId!, {
        guest_id: selectedGuest,
        pledged_amount: Number(pledgeAmount),
        payment_deadline: deadline || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["michango"] });
      qc.invalidateQueries({ queryKey: ["michango-summary"] });
      setShowAddPledge(false);
      setSelectedGuest("");
      setPledgeAmount("");
      setDeadline("");
      toast.success("Pledge added");
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? "Failed to add pledge"),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (pledgeId: string) =>
      michangoApi.recordPayment(eventId!, pledgeId, {
        amount_paid: Number(payAmount),
        payment_method: payMethod,
        payment_reference: payRef || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["michango"] });
      qc.invalidateQueries({ queryKey: ["michango-summary"] });
      setShowPayment(null);
      setPayAmount("");
      setPayRef("");
      toast.success("Payment recorded");
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.error?.message ?? "Failed to record payment",
      ),
  });

  const reminderMutation = useMutation({
    mutationFn: () =>
      michangoApi.sendReminders(eventId!, ["pending", "partial", "overdue"]),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["michango"] });
      qc.invalidateQueries({ queryKey: ["michango-reminders", eventId] });
      toast.success(
        `Reminders processed: ${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}`,
      );
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Failed to send reminders",
      ),
  });

  const progress = (paid: number, pledged: number) =>
    pledged > 0 ? Math.min(100, (paid / pledged) * 100) : 0;

  const reminderStats = useMemo(() => {
    return reminderHistory.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === "sent") acc.sent += 1;
        if (item.status === "failed") acc.failed += 1;
        return acc;
      },
      { total: 0, sent: 0, failed: 0 },
    );
  }, [reminderHistory]);

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Total pledged"
            value={formatTZS(summary.total_pledged_tsh)}
            icon={Banknote}
            color="blue"
          />
          <StatCard
            title="Collected"
            value={formatTZS(summary.total_collected_tsh)}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            title="Outstanding"
            value={formatTZS(summary.total_outstanding_tsh)}
            icon={AlertCircle}
            color="red"
          />
          <StatCard
            title="Collection rate"
            value={`${summary.collection_rate_percent}%`}
            icon={TrendingUp}
            color="gold"
            subtitle={`${summary.paid_count} fully paid · ${summary.overdue_count} overdue`}
          />
        </div>
      )}

      {summary && summary.total_pledged_tsh > 0 && (
        <div className="rounded-[26px] border border-white/80 bg-white/95 p-5 shadow-lg shadow-slate-200/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Michango progress
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">
                {formatTZS(summary.total_collected_tsh)} collected so far
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Target: {formatTZS(summary.total_pledged_tsh)}
              </p>
            </div>
            <div className="rounded-2xl bg-gold-50 px-4 py-3 text-gold-800">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Completion
              </p>
              <p className="text-2xl font-black">
                {summary.collection_rate_percent}%
              </p>
            </div>
          </div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${summary.collection_rate_percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                statusFilter === value
                  ? "bg-navy-900 text-white shadow-lg shadow-navy-900/10"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            isLoading={reminderMutation.isPending}
            onClick={() => reminderMutation.mutate()}
          >
            <Bell className="h-4 w-4" /> Send reminders
          </Button>
          <Button size="sm" onClick={() => setShowAddPledge(true)}>
            <Plus className="h-4 w-4" /> Add pledge
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-[26px] border border-white/80 bg-white/95 shadow-lg shadow-slate-200/60">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Loading pledges…
            </div>
          ) : pledges.length === 0 ? (
            <div className="p-12 text-center">
              <Banknote className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">
                No pledges yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add the first contribution promise to start tracking collection
                progress.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Guest",
                      "Pledged",
                      "Paid",
                      "Remaining",
                      "Status",
                      "Deadline",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pledges.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {p.guest_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.guest_phone}
                        </p>
                        {p.last_reminder_sent_at && (
                          <p className="mt-1 text-xs text-slate-400">
                            Last reminder:{" "}
                            {formatDateTime(p.last_reminder_sent_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatTZS(p.pledged_amount)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {formatTZS(p.amount_paid)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p
                            className={cn(
                              "font-semibold",
                              p.remaining_amount > 0
                                ? "text-rose-600"
                                : "text-emerald-600",
                            )}
                          >
                            {formatTZS(p.remaining_amount)}
                          </p>
                          <div className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-400 to-emerald-400"
                              style={{
                                width: `${progress(p.amount_paid, p.pledged_amount)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={p.payment_status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.payment_deadline
                          ? formatDate(p.payment_deadline)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.payment_status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowPayment(p.id);
                              setPayAmount(String(p.remaining_amount));
                            }}
                          >
                            Record payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card
            title="Reminder activity"
            className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Attempts
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {reminderStats.total}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 text-center text-emerald-700">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Sent
                </p>
                <p className="mt-2 text-2xl font-black">{reminderStats.sent}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4 text-center text-rose-700">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Failed
                </p>
                <p className="mt-2 text-2xl font-black">
                  {reminderStats.failed}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {reminderHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <MessageCircleMore className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No reminder history yet
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    When you send reminders, each delivery result will appear
                    here.
                  </p>
                </div>
              ) : (
                reminderHistory.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.guest_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.guest_phone}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge label={item.channel} />
                        <Badge label={item.status} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDateTime(item.delivered_at)}
                    </div>
                    <p className="mt-3 text-sm text-slate-600 line-clamp-3">
                      {item.error_message || item.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={showAddPledge}
        onClose={() => setShowAddPledge(false)}
        title="Add pledge"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Guest *
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
              value={selectedGuest}
              onChange={(e) => setSelectedGuest(e.target.value)}
            >
              <option value="">Select guest…</option>
              {availableGuests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.full_name} ({g.phone})
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Pledged amount (TZS) *"
            type="number"
            placeholder="500000"
            value={pledgeAmount}
            onChange={(e) => setPledgeAmount(e.target.value)}
          />
          <Input
            label="Payment deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1"
              isLoading={addPledgeMutation.isPending}
              disabled={!selectedGuest || !pledgeAmount}
              onClick={() => addPledgeMutation.mutate()}
            >
              Add pledge
            </Button>
            <Button variant="ghost" onClick={() => setShowAddPledge(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!showPayment}
        onClose={() => setShowPayment(null)}
        title="Record payment"
      >
        <div className="space-y-4">
          <Input
            label="Amount paid (TZS) *"
            type="number"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Payment method
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              {["cash", "mpesa", "bank", "other"].map((method) => (
                <option key={method} value={method}>
                  {method.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Reference"
            placeholder="Optional receipt or transaction number"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1"
              isLoading={recordPaymentMutation.isPending}
              disabled={!payAmount || !showPayment}
              onClick={() =>
                showPayment && recordPaymentMutation.mutate(showPayment)
              }
            >
              Save payment
            </Button>
            <Button variant="ghost" onClick={() => setShowPayment(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
