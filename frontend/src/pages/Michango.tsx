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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const pledgeSchema = z.object({
  guest_id: z.string().min(1, "Guest is required"),
  pledged_amount: z.coerce.number().positive("Must be greater than 0"),
  payment_deadline: z.string().optional(),
});
type PledgeForm = z.infer<typeof pledgeSchema>;

const paymentSchema = z.object({
  amount_paid: z.coerce.number().positive("Must be greater than 0"),
  payment_method: z.enum(["cash", "mpesa", "bank", "other"]),
  payment_reference: z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

export default function Michango() {
  const { id: eventId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddPledge, setShowAddPledge] = useState(false);
  const [showPayment, setShowPayment] = useState<string | null>(null);

  const pledgeForm = useForm<PledgeForm>({
    resolver: zodResolver(pledgeSchema),
  });
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_method: "cash" },
  });

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

  const availableGuests = useMemo(() => {
    const pledgedIds = new Set(pledges.map((p) => p.guest_id));
    return allGuests.filter((g) => !pledgedIds.has(g.id));
  }, [allGuests, pledges]);

  const addPledgeMutation = useMutation({
    mutationFn: (data: PledgeForm) =>
      michangoApi.addPledge(eventId!, {
        guest_id: data.guest_id,
        pledged_amount: data.pledged_amount,
        payment_deadline: data.payment_deadline || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["michango"] });
      qc.invalidateQueries({ queryKey: ["michango-summary"] });
      setShowAddPledge(false);
      pledgeForm.reset();
      toast.success("Pledge added");
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : "Failed to add pledge";
      toast.error(message);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ pledgeId, data }: { pledgeId: string; data: PaymentForm }) =>
      michangoApi.recordPayment(eventId!, pledgeId, {
        amount_paid: data.amount_paid,
        payment_method: data.payment_method,
        payment_reference: data.payment_reference || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["michango"] });
      qc.invalidateQueries({ queryKey: ["michango-summary"] });
      setShowPayment(null);
      paymentForm.reset();
      toast.success("Payment recorded");
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error ? e.message : "Failed to record payment";
      toast.error(message);
    },
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
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to send reminders";
      toast.error(message);
    },
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
            <div className="p-8 text-center text-sm text-slate-600">
              Loading pledges…
            </div>
          ) : pledges.length === 0 ? (
            <div className="p-12 text-center">
              <Banknote className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">
                No pledges yet
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
                  {/* CHANGE: 'p' is now correctly scoped inside this .map() function */}
                  {pledges.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {p.guest_name}
                        </p>
                        <p className="text-xs text-slate-600">
                          {p.guest_phone}
                        </p>
                        {p.last_reminder_sent_at && (
                          <p className="mt-1 text-xs text-slate-500">
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
                      <td className="px-4 py-3 text-slate-600">
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
                              paymentForm.reset({
                                amount_paid: p.remaining_amount,
                                payment_method: "cash",
                              });
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

        {/* Reminder Activity Card */}
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

      {/* Modals remain exactly as provided in the previous response */}
      <Modal
        isOpen={showAddPledge}
        onClose={() => setShowAddPledge(false)}
        title="Add pledge"
      >
        <form
          onSubmit={pledgeForm.handleSubmit((data) =>
            addPledgeMutation.mutate(data),
          )}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Guest *
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
              {...pledgeForm.register("guest_id")}
            >
              <option value="">Select guest…</option>
              {availableGuests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.full_name} ({g.phone})
                </option>
              ))}
            </select>
            {pledgeForm.formState.errors.guest_id && (
              <p className="text-xs text-rose-500 mt-1">
                {pledgeForm.formState.errors.guest_id.message}
              </p>
            )}
          </div>
          <Input
            label="Pledged amount (TZS) *"
            type="number"
            placeholder="500000"
            error={pledgeForm.formState.errors.pledged_amount?.message}
            {...pledgeForm.register("pledged_amount")}
          />
          <Input
            label="Payment deadline"
            type="date"
            {...pledgeForm.register("payment_deadline")}
          />
          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              isLoading={addPledgeMutation.isPending}
            >
              Add pledge
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddPledge(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!showPayment}
        onClose={() => setShowPayment(null)}
        title="Record payment"
      >
        <form
          onSubmit={paymentForm.handleSubmit((data) => {
            if (showPayment)
              recordPaymentMutation.mutate({ pledgeId: showPayment, data });
          })}
          className="space-y-4"
        >
          <Input
            label="Amount paid (TZS) *"
            type="number"
            error={paymentForm.formState.errors.amount_paid?.message}
            {...paymentForm.register("amount_paid")}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Payment method
            </label>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
              {...paymentForm.register("payment_method")}
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
            {...paymentForm.register("payment_reference")}
          />
          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              isLoading={recordPaymentMutation.isPending}
              disabled={!showPayment}
            >
              Save payment
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPayment(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
