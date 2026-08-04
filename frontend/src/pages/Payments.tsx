// src/pages/Payments.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Filter,
} from "lucide-react";
import { paymentsApi } from "@/api/payment";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import { formatTZS, formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Payment } from "@/types";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Completed", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
];

const statusIcon = (s: string) => {
  if (s === "completed")
    return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (s === "pending") return <Clock className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-rose-500" />;
};

export default function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["payments", page, status],
    queryFn: () => paymentsApi.list(page, 20, status || undefined),
  });

  const { data: summary } = useQuery({
    queryKey: ["payments-summary"],
    queryFn: () => paymentsApi.summary(),
  });

  const payments = data?.data ?? [];
  const pagination = data?.pagination;

  const handleExport = async () => {
    try {
      const res = await paymentsApi.export("csv");
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-slate-600 mt-1">
            M-Pesa and card payment history
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatTZS(summary?.total_revenue_tsh ?? 0)}
          icon={CreditCard}
          color="green"
        />
        <StatCard
          title="Completed"
          value={summary?.completed_count ?? 0}
          icon={CheckCircle}
          color="gold"
        />
        <StatCard
          title="Pending"
          value={summary?.pending_count ?? 0}
          icon={Clock}
          color="blue"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
        <Filter className="ml-2 h-4 w-4 text-slate-400" />
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-semibold transition",
              status === value
                ? "bg-navy-900 text-white shadow-lg shadow-navy-900/10"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Loading payments…
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No payments found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Status", "Package", "Amount", "Phone", "Receipt", "Date"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p: Payment) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {statusIcon(p.status)}
                      <Badge label={p.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.package_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {formatTZS(p.amount_tsh)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {p.payer_phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {p.mpesa_receipt_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDateTime(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {pagination.total_pages}
          </span>
          <button
            disabled={page >= pagination.total_pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
