// ==============================================================================
// FILE: src/pages/Payments.tsx
// ==============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle, Clock, XCircle } from "lucide-react";
import { apiClient } from "@/api/client";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import { formatTZS, formatDateTime } from "@/utils/format";
import type { Payment, PaginatedResponse } from "@/types";

const statusIcon = (s: string) => {
  if (s === "completed")
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (s === "pending") return <Clock className="w-4 h-4 text-yellow-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
};

export default function Payments() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["payments", page],
    queryFn: async (): Promise<PaginatedResponse<Payment>> => {
      const res = await apiClient.get("/payments", {
        params: { page, per_page: 20 },
      });
      return res.data;
    },
  });

  const payments = data?.data ?? [];
  const pagination = data?.pagination;

  const totalRevenue = payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + p.amount_tsh, 0);
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const completedCount = payments.filter(
    (p) => p.status === "completed",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">M-Pesa payment history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatTZS(totalRevenue)}
          icon={CreditCard}
          color="green"
        />
        <StatCard
          title="Completed"
          value={completedCount}
          icon={CheckCircle}
          color="gold"
        />
        <StatCard
          title="Pending"
          value={pendingCount}
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Loading payments…
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No payments yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Status",
                  "Package",
                  "Amount",
                  "Phone",
                  "M-Pesa Receipt",
                  "Date",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
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

      {/* Pagination */}
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
