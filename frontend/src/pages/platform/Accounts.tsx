// ==============================================================================
// FILE: src/pages/platform/Accounts.tsx
// ==============================================================================
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  LogIn,
  Eye,
  Trash2,
  RotateCcw,
  Ban,
} from "lucide-react";
import toast from "react-hot-toast";
import { platformApi } from "@/api/platform";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { formatTZS, formatDate } from "@/utils/format";
import type { PlatformCustomer } from "@/types";
import CreateOrganizationModal from "@/components/platform/CreateOrganizationModal";

export default function Accounts() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState<PlatformCustomer | null>(null);
  const [suspendConfirm, setSuspendConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: () => platformApi.customers(),
  });

  const approveMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.approveAccount(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("Account approved");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.rejectAccount(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("Account rejected");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.suspendAccount(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("Account suspended");
      setSuspendConfirm(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to suspend");
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.reactivateAccount(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("Account reactivated");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to reactivate");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.deleteAccount(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      toast.success("Account deleted");
      setDeleteConfirm(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    },
  });

  const list = customers ?? [];
  const pendingApprovals = list.filter((c) => c.account_status === "pending_review");

  const statusActions = (c: PlatformCustomer) => {
    switch (c.account_status) {
      case "pending_review":
        return (
          <div className="flex gap-2">
            <button
              onClick={() => approveMutation.mutate(c.organization_id)}
              disabled={approveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              onClick={() => rejectMutation.mutate(c.organization_id)}
              disabled={rejectMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        );
      case "active":
        return (
          <div className="flex gap-2">
            <button
              onClick={() => {
                platformApi.impersonateOrganization(c.organization_id).then((r: any) => {
                  localStorage.setItem("access_token", r.data.access_token);
                  window.location.href = "/dashboard";
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              <LogIn className="h-3.5 w-3.5" /> Login as org
            </button>
            <button
              onClick={() => setViewOrg(c)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </button>
            <button
              onClick={() => setSuspendConfirm(c.organization_id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              <Ban className="h-3.5 w-3.5" /> Suspend
            </button>
            <button
              onClick={() => setDeleteConfirm(c.organization_id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        );
      case "suspended":
        return (
          <div className="flex gap-2">
            <button
              onClick={() => reactivateMutation.mutate(c.organization_id)}
              disabled={reactivateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reactivate
            </button>
            <button
              onClick={() => setViewOrg(c)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </button>
            <button
              onClick={() => setDeleteConfirm(c.organization_id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        );
      default: // rejected, other statuses
        return (
          <div className="flex gap-2">
            <button
              onClick={() => setViewOrg(c)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </button>
            <button
              onClick={() => setDeleteConfirm(c.organization_id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-slate-600 mt-1">
            Approve & manage tenant organizations.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create organization
        </Button>
      </div>

      {pendingApprovals.length > 0 && (
        <Card
          title="Pending approvals"
          action={
            <span className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              {pendingApprovals.length} awaiting review
            </span>
          }
        >
          <div className="space-y-3">
            {pendingApprovals.map((c) => (
              <div
                key={c.organization_id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {c.display_name}
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {c.admin_email} · {c.current_plan_name ?? "No plan"} ·{" "}
                    {formatTZS(c.total_revenue_tsh)} paid
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(c.organization_id)}
                    disabled={approveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(c.organization_id)}
                    disabled={rejectMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="All customer accounts">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No customers yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Customer accounts">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Organization", "Admin", "Status", "Users", "Events", "Revenue", "Plan", "Last activity", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((c: PlatformCustomer) => (
                  <tr key={c.organization_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.display_name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.admin_email}</td>
                    <td className="px-4 py-3"><Badge label={c.account_status} /></td>
                    <td className="px-4 py-3 text-gray-700">{c.users_count}</td>
                    <td className="px-4 py-3 text-gray-700">{c.active_events_count}/{c.events_count}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatTZS(c.total_revenue_tsh)}</td>
                    <td className="px-4 py-3">
                      {c.current_plan_name ? (
                        <span className="text-xs font-semibold text-gold-700">{c.current_plan_name}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.last_activity_at ? formatDate(c.last_activity_at) : "—"}
                    </td>
                    <td className="px-4 py-3">{statusActions(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* View Organization Modal */}
      <Modal isOpen={!!viewOrg} onClose={() => setViewOrg(null)} title="Organization details" size="lg">
        {viewOrg && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Display name</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{viewOrg.display_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Account status</p>
                <div className="mt-1"><Badge label={viewOrg.account_status} /></div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Admin email</p>
                <p className="text-sm text-gray-900 mt-1">{viewOrg.admin_email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current plan</p>
                <p className="text-sm text-gray-900 mt-1">{viewOrg.current_plan_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Users</p>
                <p className="text-sm text-gray-900 mt-1">{viewOrg.users_count}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Events (active/total)</p>
                <p className="text-sm text-gray-900 mt-1">{viewOrg.active_events_count} / {viewOrg.events_count}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total revenue</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{formatTZS(viewOrg.total_revenue_tsh)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Last activity</p>
                <p className="text-sm text-gray-900 mt-1">{viewOrg.last_activity_at ? formatDate(viewOrg.last_activity_at) : "—"}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setViewOrg(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Suspend Confirmation Modal */}
      <Modal isOpen={!!suspendConfirm} onClose={() => setSuspendConfirm(null)} title="Suspend account" size="sm">
        <p className="text-sm text-slate-600">
          Are you sure you want to suspend this account? Users will not be able to access the platform.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setSuspendConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => suspendMutation.mutate(suspendConfirm!)} isLoading={suspendMutation.isPending}>
            Suspend
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete account" size="sm">
        <p className="text-sm text-slate-600">
          Are you sure you want to permanently delete this account? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="rose" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </Modal>

      <CreateOrganizationModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}