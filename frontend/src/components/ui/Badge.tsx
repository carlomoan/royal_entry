// ==============================================================================
// FILE: src/components/ui/Badge.tsx
// ==============================================================================

import { cn } from "@/utils/cn";

const variants: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  approved: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  active: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  completed: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
  cancelled: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  pending: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  partial: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  paid: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  overdue: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  processing: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  sent: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  failed: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  scanned: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  viewed: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
  expired: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  confirmed: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  declined: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
  whatsapp: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  sms: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  both: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
  manual: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  qr: "bg-gold-100 text-gold-800 ring-1 ring-gold-300",
  vip: "bg-gold-100 text-gold-800 ring-1 ring-gold-300",
  regular: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  staff: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  family: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
  friend: "bg-pink-100 text-pink-700 ring-1 ring-pink-200",
};

export default function Badge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const normalized = label?.toString?.().trim() ?? "";
  const key = normalized.toLowerCase();
  const lookup =
    variants[key] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize tracking-wide",
        lookup,
        className,
      )}
    >
      {normalized.replace(/_/g, " ")}
    </span>
  );
}
