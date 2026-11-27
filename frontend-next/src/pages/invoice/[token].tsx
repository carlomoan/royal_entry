"use client";
// ==============================================================================
// Public invoice view (/invoice/<token>) — no login required. The HTML rendered
// here comes from the editable invoice document template, so guests see exactly
// what the account configured in Settings → Document Templates.
// ==============================================================================
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import {
  AlertCircle, Building2, CalendarDays, Download, FileText, Loader2, Printer,
} from "lucide-react";
import api from "@/lib/api";
import { Badge, Button } from "@/components/ui";
import BrandLogo from "@/components/brand/BrandLogo";

type InvoiceData = {
  invoice_number: string;
  company_name: string;
  event_title: string;
  organization_name: string;
  amount_tsh: number | string;
  tax_amount_tsh: number | string;
  tin: string;
  status: string;
  html: string;
};

function money(value: number | string | undefined | null): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("en-US") : "0";
}

function statusVariant(status?: string): string {
  switch ((status ?? "").toLowerCase()) {
    case "paid":
      return "green";
    case "pending":
    case "pending_review":
    case "sent":
      return "gold";
    case "overdue":
    case "cancelled":
    case "void":
      return "rose";
    default:
      return "slate";
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-600" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || "—"}</p>
      </div>
    </div>
  );
}

function MoneyCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 ${
        highlight ? "border-gold-300 bg-gold-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 break-words text-lg font-extrabold ${highlight ? "text-gold-800" : "text-navy-950"}`}>
        {value}
      </p>
    </div>
  );
}

export default function PublicInvoicePage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : undefined;

  const { data, isLoading, isError } = useQuery<InvoiceData>({
    queryKey: ["public-invoice", token],
    queryFn: async () =>
      (await api.get(`/public/invoices/${encodeURIComponent(token!)}`)).data.data,
    enabled: !!token,
    retry: false,
  });

  const downloadHtml = () => {
    if (!data?.html) return;
    const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(data.invoice_number || "invoice").replace(/[^a-z0-9_-]+/gi, "-")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!token || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-6">
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 className="h-10 w-10 animate-spin text-gold-400" />
          <p className="text-sm text-slate-300">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <AlertCircle className="mx-auto mb-4 h-14 w-14 text-rose-500" />
          <h1 className="text-2xl font-bold text-slate-900">Invoice not found</h1>
          <p className="mt-2 break-words text-sm text-slate-600">
            This link may have expired or is invalid. Please contact the event organizer for help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 px-4 py-8 print:bg-white print:p-0 sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-500 text-navy-950">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <BrandLogo
                showName
                className="h-8 w-8"
                nameClassName="text-xs font-bold uppercase tracking-[0.25em] text-white"
              />
              <p className="break-words text-sm text-slate-300">Invoice {data.invoice_number}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadHtml}>
              <Download className="h-3.5 w-3.5" /> Download HTML
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-navy-950 px-5 py-6 text-center text-white sm:px-8">
            <div className="flex justify-center">
              <BrandLogo
                showName
                className="h-10 w-10"
                nameClassName="text-sm font-bold uppercase tracking-[0.3em] text-white"
              />
            </div>
            <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">
              Invoice {data.invoice_number}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge label={data.status || "pending"} variant={statusVariant(data.status)} />
              {data.tin && <Badge label={`TIN ${data.tin}`} variant="slate" />}
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8">
            <InfoRow icon={Building2} label="Company" value={data.company_name} />
            <InfoRow icon={CalendarDays} label="Event" value={data.event_title} />
            <InfoRow icon={Building2} label="Organization" value={data.organization_name} />
            <InfoRow icon={FileText} label="Invoice number" value={data.invoice_number} />
          </div>

          <div className="grid gap-3 border-t border-slate-100 px-5 py-5 sm:grid-cols-3 sm:px-8">
            <MoneyCell label="Amount (TZS)" value={money(data.amount_tsh)} />
            <MoneyCell label="VAT (TZS)" value={money(data.tax_amount_tsh)} />
            <MoneyCell label="TIN" value={data.tin || "—"} highlight />
          </div>

          <div className="border-t border-slate-100 p-5 sm:p-8 print:p-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Invoice document
            </p>
            <iframe
              title="Invoice document"
              sandbox=""
              srcDoc={data.html || ""}
              className="w-full min-h-[500px] rounded-lg border border-slate-200 bg-white"
            />
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 print:hidden">
          Questions about this invoice? Contact the event organizer.
        </p>
      </div>
    </div>
  );
}
