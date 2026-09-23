"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard, FileDown, Wallet, Clock, CheckCircle2, ArrowUpRight, Search,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, StatCard, Select, Modal, Button } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatTZS, formatDate } from "@/lib/utils";

export default function PaymentsPage() {
  const [filterStatus, setFilterStatus] = useState("");
  const [statusPaymentId, setStatusPaymentId] = useState<string | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get("/payments")).data.data,
  });
  const { data: paymentStatus, isFetching: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["payment-status", statusPaymentId],
    queryFn: async () => (await api.get(`/payments/${statusPaymentId}/status`)).data.data,
    enabled: !!statusPaymentId,
  });

  const stats = useMemo(() => {
    const list = (payments as any[]) ?? [];
    const completed = list.filter((p) => p.status === "completed");
    const pending = list.filter((p) => p.status === "pending");
    return {
      total_paid: completed.reduce((s, p) => s + (p.amount_tsh ?? 0), 0),
      completed_count: completed.length,
      pending_count: pending.length,
      pending_amount: pending.reduce((s, p) => s + (p.amount_tsh ?? 0), 0),
    };
  }, [payments]);

  const filtered = useMemo(() => {
    const list = (payments as any[]) ?? [];
    return filterStatus ? list.filter((p) => p.status === filterStatus) : list;
  }, [payments, filterStatus]);

  const downloadReceipt = (id: string) => {
    api.get(`/payments/${id}/receipt`, { responseType: "blob" }).then((r: any) => {
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Receipt downloaded");
    }).catch(() => toast.error("Failed to download receipt"));
  };

  const columns: ColumnDef<any>[] = [
    { key: "payment_type", label: "Type", sortable: true, render: (p) => <span className="text-slate-700">{p.payment_type}</span> },
    { key: "amount_tsh", label: "Amount", sortable: true, render: (p) => <span className="font-semibold text-slate-900">{formatTZS(p.amount_tsh)}</span> },
    { key: "payment_method", label: "Method", sortable: true, render: (p) => <span className="text-slate-500">{p.payment_method}</span> },
    { key: "payer_phone", label: "Payer", render: (p) => <span className="text-slate-500">{p.payer_phone ?? "—"}</span> },
    { key: "status", label: "Status", sortable: true, render: (p) => <Badge label={p.status} /> },
    { key: "created_at", label: "Date", sortable: true, render: (p) => <span className="text-xs text-slate-500">{formatDate(p.created_at)}</span> },
    {
      key: "receipt", label: "Receipt",
      render: (p) => <div className="flex items-center gap-2">
        <button onClick={() => setStatusPaymentId(p.id)} title="Check payment status"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-gold-300 hover:text-gold-700">
          <Search className="h-3.5 w-3.5" /> Status
        </button>
        {p.status === "completed" && <button onClick={() => downloadReceipt(p.id)} title="Download receipt"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-gold-300 hover:text-gold-700">
          <FileDown className="h-3.5 w-3.5" /> Receipt
        </button>}
      </div>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500">Track collections and transactions</p>
        </div>
        <Link href="/billing"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-gold-600">
          Subscription & Invoices <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard title="Total Collected" value={formatTZS(stats.total_paid)} icon={CheckCircle2} color="green" subtitle={`${stats.completed_count} completed`} />
        <StatCard title="Pending" value={formatTZS(stats.pending_amount)} icon={Clock} color="gold" subtitle={`${stats.pending_count} pending`} />
        <StatCard title="All Transactions" value={(payments as any[])?.length ?? 0} icon={Wallet} color="blue" />
      </div>

      <Card title="Transactions" action={
        <div className="w-40">
          <Select label="" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      }>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <DataTable
            data={filtered}
            columns={columns}
            searchPlaceholder="Search payments..."
            searchFields={["payment_type", "payment_method", "payer_phone", "status"]}
            sortField="created_at"
            pageSize={20}
            emptyMessage="No payments yet"
          />
        )}
      </Card>

      <Modal isOpen={!!statusPaymentId} onClose={() => setStatusPaymentId(null)} title="Payment Status" size="sm">
        {statusLoading ? <p className="py-6 text-sm text-slate-500">Checking payment status…</p> : paymentStatus ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><Badge label={paymentStatus.status ?? "unknown"} /></div>
            {paymentStatus.result_desc && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{paymentStatus.result_desc}</p>}
            <div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => refetchStatus()}>Refresh</Button><Button size="sm" onClick={() => setStatusPaymentId(null)}>Close</Button></div>
          </div>
        ) : <p className="py-6 text-sm text-slate-500">No status returned.</p>}
      </Modal>
    </div>
  );
}
