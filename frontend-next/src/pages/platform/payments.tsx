"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import api from "@/lib/api";
import { Card, Badge } from "@/components/ui";
import { formatTZS, formatDate } from "@/lib/utils";

export default function PlatformPaymentsPage() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["platform-payments"],
    queryFn: async () => (await api.get("/payments")).data.data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Payments</h1>
        <p className="text-sm text-slate-500">All M-Pesa and card transactions</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : payments.length === 0 ? (
        <Card><div className="py-12 text-center"><CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No payments yet</p></div></Card>
      ) : (
        <Card title="Transactions">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Type", "Amount", "Method", "Payer", "Status", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: any) => (
                  <tr key={p.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{p.payment_type}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatTZS(p.amount_tsh)}</td>
                    <td className="px-4 py-3 text-slate-500">{p.payment_method}</td>
                    <td className="px-4 py-3 text-slate-500">{p.payer_phone ?? "—"}</td>
                    <td className="px-4 py-3"><Badge label={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}