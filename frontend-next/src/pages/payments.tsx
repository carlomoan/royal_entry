"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, FileDown } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatTZS, formatDate } from "@/lib/utils";

export default function PaymentsPage() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get("/payments")).data.data,
  });

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
      key: "receipt",
      label: "Receipt",
      render: (p) => p.status === "completed" ? (
        <button onClick={() => downloadReceipt(p.id)} title="Download receipt" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-gold-300 hover:text-gold-700">
          <FileDown className="h-3.5 w-3.5" /> Receipt
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">Track collections and transactions</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : payments.length === 0 ? (
        <Card><div className="py-12 text-center"><CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No payments yet</p></div></Card>
      ) : (
        <Card title="Transactions">
          <DataTable
            data={payments}
            columns={columns}
            searchPlaceholder="Search payments..."
            searchFields={["payment_type", "payment_method", "payer_phone", "status"]}
            sortField="created_at"
            pageSize={20}
            emptyMessage="No payments yet"
          />
        </Card>
      )}
    </div>
  );
}
