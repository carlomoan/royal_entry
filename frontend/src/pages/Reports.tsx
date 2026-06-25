// ==============================================================================
// FILE: src/pages/Reports.tsx
// ==============================================================================
// Cross-event summaries and CSV exports.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  Users,
  UserCheck,
  CreditCard,
  Coins,
  Megaphone,
  Download,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/api/reports";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import OrganizationScopeSelect from "@/components/OrganizationScopeSelect";
import { formatTZS } from "@/utils/format";
import type { ReportKind } from "@/types";

const exportOptions: {
  key: ReportKind;
  label: string;
  description: string;
  icon: typeof CalendarDays;
}[] = [
  {
    key: "events",
    label: "Events",
    description: "Titles, dates, venues and status",
    icon: CalendarDays,
  },
  {
    key: "guests",
    label: "Guests",
    description: "Guests with RSVP status per event",
    icon: Users,
  },
  {
    key: "payments",
    label: "Payments",
    description: "M-Pesa transactions and receipts",
    icon: CreditCard,
  },
  {
    key: "michango",
    label: "Michango",
    description: "Pledges, payments and balances",
    icon: Coins,
  },
  {
    key: "broadcasts",
    label: "Broadcasts",
    description: "Campaigns and delivery results",
    icon: Megaphone,
  },
];

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [exporting, setExporting] = useState<ReportKind | null>(null);
  const [orgId, setOrgId] = useState<string | undefined>(undefined);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["reports-summary", orgId],
    queryFn: () => reportsApi.summary(orgId),
  });

  const handleExport = async (kind: ReportKind) => {
    setExporting(kind);
    try {
      const { filename, content } = await reportsApi.export(kind, orgId);
      downloadCsv(filename, content);
      toast.success(`${kind} report downloaded`);
    } catch {
      toast.error("Failed to export report");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Workspace-wide summaries and downloadable CSV exports.
          </p>
        </div>
        <OrganizationScopeSelect value={orgId} onChange={setOrgId} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          title="Total Events"
          value={summary?.total_events ?? 0}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          title="Total Guests"
          value={summary?.total_guests ?? 0}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Total Arrivals"
          value={summary?.total_arrivals ?? 0}
          icon={UserCheck}
          color="green"
        />
        <StatCard
          title="Payments Collected"
          value={formatTZS(summary?.total_payments_tsh ?? 0)}
          icon={CreditCard}
          color="gold"
        />
        <StatCard
          title="Michango Collected"
          value={formatTZS(summary?.total_michango_tsh ?? 0)}
          icon={Coins}
          color="green"
        />
        <StatCard
          title="Broadcasts Sent"
          value={summary?.total_broadcasts ?? 0}
          icon={Megaphone}
          color="blue"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading summary…</p>}

      {/* Export cards */}
      <Card title="Export CSV reports">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {exportOptions.map(({ key, label, description, icon: Icon }) => (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-gold-300 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-50 text-gold-600 ring-1 ring-gold-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </div>
              <button
                onClick={() => handleExport(key)}
                disabled={exporting !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-gold-300 hover:bg-gold-50 disabled:translate-y-0 disabled:opacity-50"
              >
                {exporting === key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {exporting === key ? "Exporting…" : "Download CSV"}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs text-gray-500">
        <BarChart3 className="h-4 w-4 text-gold-600" />
        Account users are auto-scoped to their organization. Platform admins can
        use the scope selector to view a single tenant or all tenants at once.
      </div>
    </div>
  );
}
