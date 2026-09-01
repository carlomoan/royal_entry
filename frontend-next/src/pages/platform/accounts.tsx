"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Loader2, CheckCircle2, XCircle, AlertTriangle, Plus,
  LogIn, Eye, Ban, Trash2, User as UserIcon, Ban as BanIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, Badge, Button, Modal, Input, Select } from "@/components/ui";
import { DataTable, type ColumnDef, type BulkAction } from "@/components/ui/DataTable";
import { formatTZS, formatDate } from "@/lib/utils";
import { AccountProfileModal } from "@/components/modals/AccountProfileModal";

export default function AccountsPage() {
  const qc = useQueryClient();
  const { startImpersonation } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState<any | null>(null);
  const [profileOrgId, setProfileOrgId] = useState<string | null>(null);
  const [impersonateRoleOrg, setImpersonateRoleOrg] = useState<any | null>(null);
  const [impersonateRole, setImpersonateRole] = useState("viewer");
  const [suspendOrg, setSuspendOrg] = useState<string | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<string | null>(null);

  const ACCOUNT_ROLE_OPTIONS = [
    { value: "account_admin", label: "Account Admin" },
    { value: "event_manager", label: "Event Manager" },
    { value: "event_accountant", label: "Event Accountant" },
    { value: "secretary", label: "Secretary" },
    { value: "scanner_attendant", label: "Scanner Attendant" },
    { value: "viewer", label: "Viewer" },
  ];

  const impersonateAsRole = () => {
    if (!impersonateRoleOrg) return;
    api.post(`/platform/organizations/${impersonateRoleOrg.organization_id}/impersonate-role`, { role: impersonateRole })
      .then((r: any) => {
        const currentToken = localStorage.getItem("access_token");
        if (currentToken) localStorage.setItem("impersonation_original_token", currentToken);
        localStorage.setItem("access_token", r.data.data.access_token);
        toast.success(`Impersonating as ${impersonateRole} in ${impersonateRoleOrg.display_name}`);
        setImpersonateRoleOrg(null);
        window.location.href = "/dashboard";
      })
      .catch((e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to impersonate role"));
  };

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: async () => (await api.get("/platform/customers")).data.data,
  });

  const approveMutation = useMutation({
    mutationFn: (orgId: string) => api.post(`/platform/customers/${orgId}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); toast.success("Account approved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: (orgId: string) => api.post(`/platform/customers/${orgId}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); toast.success("Account rejected"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const suspendMutation = useMutation({
    mutationFn: (orgId: string) => api.post(`/platform/customers/${orgId}/suspend`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); setSuspendOrg(null); toast.success("Account suspended"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (orgId: string) => api.delete(`/platform/customers/${orgId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); setDeleteOrg(null); toast.success("Account deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const impersonate = (orgId: string) => {
    startImpersonation(orgId);
  };

  const list = customers;
  const pendingApprovals = list.filter((c: any) => c.account_status === "pending_review");

  const accountColumns: ColumnDef<any>[] = [
    {
      key: "display_name",
      label: "Organization",
      sortable: true,
      render: (c) => (
        <button onClick={() => setProfileOrgId(c.organization_id)} className="font-medium text-slate-900 transition hover:text-gold-700 hover:underline" title="View account profile">
          {c.display_name}
        </button>
      ),
    },
    { key: "admin_email", label: "Admin", sortable: true, render: (c) => <span className="text-slate-500">{c.admin_email}</span> },
    { key: "account_status", label: "Status", sortable: true, render: (c) => <Badge label={c.account_status} /> },
    { key: "users_count", label: "Users", sortable: true, render: (c) => <span className="text-slate-600">{c.users_count}</span> },
    { key: "events_count", label: "Events", sortable: true, render: (c) => <span className="text-slate-600">{c.active_events_count}/{c.events_count}</span> },
    { key: "total_revenue_tsh", label: "Revenue", sortable: true, render: (c) => <span className="font-semibold text-slate-900">{formatTZS(c.total_revenue_tsh)}</span> },
    {
      key: "current_plan_name",
      label: "Plan",
      render: (c) => c.current_plan_name ? <span className="text-xs font-semibold text-gold-700">{c.current_plan_name}</span> : <span className="text-slate-300">—</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (c) => (
        <div className="flex items-center gap-1.5">
          {c.account_status === "pending_review" && (
            <>
              <button onClick={() => approveMutation.mutate(c.organization_id)} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Approve</button>
              <button onClick={() => rejectMutation.mutate(c.organization_id)} className="text-xs font-semibold text-rose-700 hover:text-rose-800">Reject</button>
            </>
          )}
          {c.account_status === "active" && (
            <button onClick={() => impersonate(c.organization_id)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">
              <LogIn className="h-3.5 w-3.5" /> Login as org
            </button>
          )}
          {c.account_status === "active" && (
            <button onClick={() => { setImpersonateRoleOrg(c); setImpersonateRole("viewer"); }} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800" title="Impersonate as a specific role">
              <UserIcon className="h-3.5 w-3.5" /> Role
            </button>
          )}
          <Link href={`/platform/accounts/${c.organization_id}`} title="View Profile" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Eye className="h-4 w-4" /></Link>
          {c.organization_id !== "00000000-0000-0000-0000-000000000000" && (
            <>
              <button onClick={() => setSuspendOrg(c.organization_id)} title="Suspend" className="rounded p-1 text-amber-600 hover:bg-amber-50"><Ban className="h-4 w-4" /></button>
              <button onClick={() => setDeleteOrg(c.organization_id)} title="Delete" className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  const accountBulkActions: BulkAction[] = [
    { key: "suspend", label: "Suspend", icon: <BanIcon className="h-3.5 w-3.5" />, onClick: (ids) => ids.forEach((id) => suspendMutation.mutate(id)) },
    { key: "delete", label: "Delete", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: (ids) => ids.forEach((id) => deleteMutation.mutate(id)) },
  ];

  const accountFilters = [
    { key: "account_status", label: "Status", options: [
      { value: "active", label: "Active" },
      { value: "pending_review", label: "Pending" },
      { value: "suspended", label: "Suspended" },
    ]},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="text-sm text-slate-500">Approve & manage tenant organizations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create organization</Button>
      </div>

      {pendingApprovals.length > 0 && (
        <Card title="Pending Approvals" action={
          <span className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" /> {pendingApprovals.length} awaiting review
          </span>
        }>
          <div className="space-y-3">
            {pendingApprovals.map((c: any) => (
              <div key={c.organization_id} className="flex items-center justify-between gap-4 rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{c.display_name}</p>
                  <p className="truncate text-xs text-slate-500">{c.admin_email} · {c.current_plan_name ?? "No plan"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveMutation.mutate(c.organization_id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
                    <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Approve
                  </button>
                  <button onClick={() => rejectMutation.mutate(c.organization_id)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                    <XCircle className="mr-1 inline h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="All Customer Accounts">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center"><Building2 className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No customers yet</p></div>
        ) : (
          <DataTable
            data={list}
            columns={accountColumns}
            searchPlaceholder="Search accounts by name or admin email..."
            searchFields={["display_name", "admin_email"]}
            filters={accountFilters}
            sortField="display_name"
            pageSize={20}
            bulkActions={accountBulkActions}
            emptyMessage="No accounts match the current filters."
          />
        )}
      </Card>

      {/* View modal */}
      <Modal isOpen={!!viewOrg} onClose={() => setViewOrg(null)} title="Organization Details">
        {viewOrg && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-slate-400">Name</p><p className="font-semibold text-slate-800">{viewOrg.display_name}</p></div>
            <div><p className="text-xs text-slate-400">Admin</p><p className="font-semibold text-slate-800">{viewOrg.admin_email}</p></div>
            <div><p className="text-xs text-slate-400">Status</p><Badge label={viewOrg.account_status} /></div>
            <div><p className="text-xs text-slate-400">Plan</p><p className="font-semibold text-slate-800">{viewOrg.current_plan_name ?? "—"}</p></div>
            <div><p className="text-xs text-slate-400">Users</p><p className="font-semibold text-slate-800">{viewOrg.users_count}</p></div>
            <div><p className="text-xs text-slate-400">Revenue</p><p className="font-semibold text-slate-800">{formatTZS(viewOrg.total_revenue_tsh)}</p></div>
            <div><p className="text-xs text-slate-400">Last Activity</p><p className="font-semibold text-slate-800">{formatDate(viewOrg.last_activity_at)}</p></div>
          </div>
        )}
      </Modal>

      {/* Suspend modal */}
      <Modal isOpen={!!suspendOrg} onClose={() => setSuspendOrg(null)} title="Suspend Account" size="sm">
        <p className="text-sm text-slate-600">Are you sure you want to suspend this account?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setSuspendOrg(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => suspendMutation.mutate(suspendOrg!)} isLoading={suspendMutation.isPending}>Suspend</Button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteOrg} onClose={() => setDeleteOrg(null)} title="Delete Account" size="sm">
        <p className="text-sm text-slate-600">Are you sure you want to delete this account? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOrg(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteOrg!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>

      {/* Impersonate as role modal */}
      <Modal isOpen={!!impersonateRoleOrg} onClose={() => setImpersonateRoleOrg(null)} title={impersonateRoleOrg ? `Impersonate in ${impersonateRoleOrg.display_name}` : ""} size="md">
        {impersonateRoleOrg && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Experience the system exactly as a user with the selected role in this account. You'll see only the features and pages that role is permitted to access.
            </p>
            <Select label="Role to impersonate" value={impersonateRole} onChange={(e) => setImpersonateRole(e.target.value)}>
              {ACCOUNT_ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setImpersonateRoleOrg(null)}>Cancel</Button>
              <Button onClick={impersonateAsRole} className="bg-violet-600 hover:bg-violet-700"><UserIcon className="h-4 w-4" /> Impersonate</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Account profile modal */}
      {profileOrgId && (
        <AccountProfileModal orgId={profileOrgId} onClose={() => setProfileOrgId(null)} />
      )}
    </div>
  );
}