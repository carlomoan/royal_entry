// ==============================================================================
// FILE: src/pages/Audit.tsx
// ==============================================================================
// CHANGE: Removed trailing spaces from statusTone return values ("active " -> "active").
// This was causing the Badge component to fail matching styles.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Download, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { auditApi } from "@/api/audit";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import OrganizationScopeSelect from "@/components/OrganizationScopeSelect";
import { formatDateTime } from "@/utils/format";
import type { AuditLog, PaginatedResponse } from "@/types";

const statusTone = (code: number): "active" | "pending" | "failed" => {
  if (code >= 200 && code < 300) return "active"; // CHANGE: Removed trailing space
  if (code >= 300 && code < 500) return "pending"; // CHANGE: Removed trailing space
  return "failed"; // CHANGE: Removed trailing space
};

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

export default function Audit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [exporting, setExporting] = useState(false);
  const [orgId, setOrgId] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", page, action, orgId],
    queryFn: (): Promise<PaginatedResponse<AuditLog>> =>
      auditApi.list({
        page,
        per_page: 25,
        action: action || undefined,
        organization_id: orgId,
      }),
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const runSearch = () => {
    setAction(searchInput.trim());
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { filename, content } = await auditApi.export({
        action: action || undefined,
        organization_id: orgId,
      });
      downloadCsv(filename, content);
      toast.success("Audit log exported");
    } catch {
      toast.error("Failed to export audit log");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every authenticated action, recorded for security and compliance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrganizationScopeSelect value={orgId} onChange={setOrgId} />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gold-300 hover:bg-gold-50 disabled:translate-y-0 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">
              Filter by action
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="e.g. create, update, delete, view"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gold-400"
                />
              </div>
              <button
                onClick={runSearch}
                className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-700"
              >
                Search
              </button>
              {action && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    setAction("");
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Loading audit entries…
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No audit entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label="Security audit log entries"
            >
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "When",
                    "User",
                    "Role",
                    "Method",
                    "Path",
                    "Action",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(log.occurred_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {log.user_email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 capitalize">
                        {log.role?.replace(/_/g, " ") ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-700">
                        {log.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[260px] truncate">
                      {log.path}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {log.action}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-600">
                          {log.status_code}
                        </span>
                        <Badge label={statusTone(log.status_code)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {pagination.total_pages} · {pagination.total} entries
          </span>
          <button
            disabled={page >= pagination.total_pages || isFetching}
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
