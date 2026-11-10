"use client";
// ==============================================================================
// Printable receipt / invoice document, styled with the RoyalEntry navy/gold
// theme. `variant` follows the standard distinction:
//   - "invoice"  → issued before payment, lists what is owed (amount due)
//   - "receipt"  → issued after payment, confirms what was received
// Wrap in a `.print-area` container to print just this document.
// ==============================================================================
import { formatTZS, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface ReceiptLine {
  description: string;
  amount: number;
}

export interface ReceiptDocumentProps {
  variant: "receipt" | "invoice";
  title?: string;
  number: string;
  issuedAt: string;
  dueAt?: string | null;
  status: string;
  billTo: { name: string; detail?: string };
  items: ReceiptLine[];
  subtotal: number;
  taxAmount: number;
  taxRate?: number;
  taxInclusive?: boolean;
  total: number;
  paidVia?: string;
  reference?: string;
  footer?: string;
}

export default function ReceiptDocument({
  variant,
  title,
  number,
  issuedAt,
  dueAt,
  status,
  billTo,
  items,
  subtotal,
  taxAmount,
  taxRate,
  taxInclusive,
  total,
  paidVia,
  reference,
  footer,
}: ReceiptDocumentProps) {
  const isReceipt = variant === "receipt";
  const heading = title ?? (isReceipt ? "RECEIPT" : "INVOICE");
  const statusLabel = isReceipt ? "PAID" : status.toUpperCase();

  return (
    <div className="print-area mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      {/* Header band */}
      <div className="bg-navy-950 px-8 py-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 text-lg font-black text-navy-950">
              R
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">RoyalEntry</p>
              <p className="text-xs text-slate-400">Elite Access Solutions</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tracking-wide text-gold-400">{heading}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-300">{number}</p>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-4 px-8 py-5 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date</p>
          <p className="font-medium text-slate-800">{formatDate(issuedAt)}</p>
        </div>
        {!isReceipt && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Due</p>
            <p className="font-medium text-slate-800">{dueAt ? formatDate(dueAt) : "—"}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{isReceipt ? "Received from" : "Billed to"}</p>
          <p className="font-medium text-slate-800">{billTo.name}</p>
          {billTo.detail && <p className="text-xs text-slate-500">{billTo.detail}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <span className={cn(
            "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
            isReceipt ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          )}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Items table */}
      <div className="px-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-navy-950 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="py-2.5 text-slate-700">{item.description}</td>
                <td className="py-2.5 text-right font-semibold text-slate-900">{formatTZS(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end px-8 py-5">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{formatTZS(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>VAT{typeof taxRate === "number" ? ` (${taxRate}%)` : ""}{taxInclusive ? " · incl." : ""}</span>
            <span>{formatTZS(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-navy-950 pt-2 text-base font-black text-navy-950">
            <span>{isReceipt ? "Amount paid" : "Total due"}</span>
            <span>{formatTZS(total)}</span>
          </div>
        </div>
      </div>

      {/* Payment / instructions */}
      {(paidVia || reference) && (
        <div className="mx-8 mb-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
          {isReceipt ? (
            <p>
              Payment received{paidVia ? ` via ${paidVia}` : ""}
              {reference ? ` · Reference: ${reference}` : ""}.
            </p>
          ) : (
            <p>Please pay the total due before the due date to keep your account active.</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 text-center text-[11px] text-slate-400">
        {footer ?? "Thank you for choosing RoyalEntry · Elite Access Solutions"}
      </div>
    </div>
  );
}