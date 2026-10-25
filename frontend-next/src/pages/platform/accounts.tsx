"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2, CheckCircle2, Eye, Pencil, Plus, ShieldCheck, SkipForward,
  Trash2, UserPlus, Users, XCircle, Zap, LogIn,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Input, Modal, Select, StatCard } from "@/components/ui";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { formatDate, formatTZS, cn } from "@/lib/utils";

type AdminMode = "skip" | "new" | "existing";

const ADMIN_OPTIONS: { key: AdminMode; label: string; hint: string; icon: any }[] = [
  { key: "skip", label: "Skip for now", hint: "Assign later from profile or Users page", icon: SkipForward },
  { key: "new", label: "New admin", hint: "Create a fresh account_admin", icon: UserPlus },
  { key: "existing", label: "Existing user", hint: "Promote a registered user", icon: Users },
];

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin", platform_admin: "Platform Admin", system_admin: "System Admin",
  account_admin: "Account Admin", event_manager: "Event Manager", event_accountant: "Event Accountant",
  secretary: "Secretary", scanner_attendant: "Scanner Attendant", viewer: "Viewer",
};
const PLATFORM_ROLES = ["superadmin", "platform_admin", "system_admin"];

export default function AccountsPage() {
  const qc = useQueryClient();
  const { startImpersonation } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Create form state
  const [displayName, setDisplayName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [adminMode, setAdminMode] = useState<AdminMode>("skip");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [existingUserId, setExistingUserId] = useState("");

  const resetCreateForm = () => {
    setDisplayName(""); setAdminEmail(""); setContactPhone(""); setBillingEmail("");
    setAdminMode("skip"); setAdminFullName(""); setAdminPassword(""); setExistingUserId("");
  };

  // Queries
  const { data: summary } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: async () => (await api.get("/platform/summary")).data.data,
  });
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: async () => (await api.get("/platform/customers")).data.data,
  });
  const { data: allUsers = [] } = useQuery({
    queryKey: ["platform-users-for-assign"],
    queryFn: async () => (await api.get("/platform/users")).data.data,
    enabled: createOpen,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => (await api.get("/platform/plans")).data.data,
  });

  const assignableUsers = allUsers.filter((u: any) => !PLATFORM_ROLES.includes(u.role));
  const pending = (customers as any[]).filter((c) => c.account_status === "pending_review");

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/platform/organizations", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      qc.invalidateQueries({ queryKey: ["platform-summary"] });
      resetCreateForm(); setCreateOpen(false);
      toast.success("Organization created");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/platform/customers/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); qc.invalidateQueries({ queryKey: ["platform-summary"] }); toast.success("Approved"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/platform/customers/${id}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); qc.invalidateQueries({ queryKey: ["platform-summary"] }); toast.success("Rejected"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to reject account"),
  });
  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/platform/customers/${id}/suspend`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); toast.success("Suspended"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/customers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-customers"] }); qc.invalidateQueries({ queryKey: ["platform-summary"] }); setDeleteConfirm(null); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const autoApprove = (form.elements.namedItem("auto_approve") as HTMLInputElement)?.checked ?? false;
    const payload: any = {
      display_name: displayName, admin_email: adminEmail,
      contact_phone: contactPhone || undefined, billing_email: billingEmail || undefined,
      auto_approve: autoApprove,
    };
    if (adminMode === "new") {
      payload.admin = { full_name: adminFullName, email: adminEmail, password: adminPassword };
    } else if (adminMode === "existing") {
      payload.existing_admin_id = existingUserId || undefined;
    }
    createMutation.mutate(payload);
  };

  // Table columns
  const columns: ColumnDef<any>[] = [
    {
      key: "display_name", label: "Organization", sortable: true,
      render: (c) => (
        <Link href={`/platform/accounts/${c.organization_id}`} className="group">
          <p className="font-semibold text-slate-900 group-hover:text-gold-700">{c.display_name}</p>
          <p className="text-xs text-slate-500">{c.admin_email}</p>
        </Link>
      ),
    },
    {
      key: "account_status", label: "Status", sortable: true,
      render: (c) => <Badge label={c.account_status} variant={c.account_status === "active" ? "green" : c.account_status === "pending_review" ? "blue" : "rose"} />,
    },
    {
      key: "current_plan_name", label: "Package", sortable: true,
      render: (c) => c.current_plan_name
        ? <Badge label={c.current_plan_name} variant="gold" />
        : <span className="text-xs text-slate-400">No plan</span>,
    },
    { key: "users_count", label: "Users", sortable: true, render: (c) => <span className="font-medium">{c.users_count ?? 0}</span> },
    { key: "events_count", label: "Events", sortable: true, render: (c) => <span>{c.events_count ?? 0}</span> },
    {
      key: "total_revenue_tsh", label: "Revenue", sortable: true,
      render: (c) => <span className="font-semibold text-emerald-700">{formatTZS(c.total_revenue_tsh)}</span>,
    },
    {
      key: "actions", label: "", render: (c) => (
        <div className="flex items-center justify-end gap-1">
          {c.account_status === "pending_review" && (
            <>
              <button onClick={() => approveMutation.mutate(c.organization_id)} title="Approve"
                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
              <button onClick={() => rejectMutation.mutate(c.organization_id)} title="Reject"
                className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><XCircle className="h-4 w-4" /></button>
            </>
          )}
          <Link href={`/platform/accounts/${c.organization_id}`} title="View / Edit"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-gold-700"><Pencil className="h-4 w-4" /></Link>
          <button onClick={() => setViewOrg(c)} title="Quick view"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Eye className="h-4 w-4" /></button>
          <button onClick={() => startImpersonation(c.organization_id)} title="Impersonate"
            className="rounded p-1.5 text-sky-600 hover:bg-sky-50"><LogIn className="h-4 w-4" /></button>
          {c.account_status === "active" ? (
            <button onClick={() => suspendMutation.mutate(c.organization_id)} title="Suspend"
              className="rounded p-1.5 text-amber-600 hover:bg-amber-50"><XCircle className="h-4 w-4" /></button>
          ) : c.account_status === "suspended" ? (
            <button onClick={() => approveMutation.mutate(c.organization_id)} title="Reactivate"
              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
          ) : null}
          <button onClick={() => setDeleteConfirm(c.organization_id)} title="Delete"
            className="rounded p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  const accountFilters = [
    { key: "account_status", label: "Status", options: [
      { value: "active", label: "Active" },
      { value: "pending_review", label: "Pending" },
      { value: "suspended", label: "Suspended" },
    ]},
  ];

  const accountBulkActions = [
    { key: "approve", label: "Approve", variant: "primary" as const, onClick: async (ids: string[]) => { for (const id of ids) await api.post(`/platform/customers/${id}/approve`); qc.invalidateQueries({ queryKey: ["platform-customers"] }); toast.success(`${ids.length} approved`); }},
    { key: "suspend", label: "Suspend", variant: "outline" as const, onClick: async (ids: string[]) => { for (const id of ids) await api.post(`/platform/customers/${id}/suspend`); qc.invalidateQueries({ queryKey: ["platform-customers"] }); toast.success(`${ids.length} suspended`); }},
    { key: "delete", label: "Delete", variant: "danger" as const, onClick: async (ids: string[]) => { for (const id of ids) await api.delete(`/platform/customers/${id}`); qc.invalidateQueries({ queryKey: ["platform-customers"] }); toast.success(`${ids.length} deleted`); }},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="text-sm text-slate-500">Approve & manage tenant organizations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New organization</Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatCard title="Total Accounts" value={summary?.total_customers ?? 0} icon={Building2} color="blue" />
        <StatCard title="Active" value={summary?.active_customers ?? 0} icon={CheckCircle2} color="green" />
        <StatCard title="Pending Review" value={pending.length} icon={ShieldCheck} color="gold" />
        <StatCard title="Total Revenue" value={formatTZS(summary?.total_revenue_tsh)} icon={Zap} color="purple" />
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <Card title={`Pending Approvals (${pending.length})`}>
          <div className="space-y-2">
            {pending.map((c: any) => (
              <div key={c.organization_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-200 bg-gold-50/40 p-3">
                <div>
                  <p className="font-semibold text-slate-900">{c.display_name}</p>
                  <p className="text-xs text-slate-500">{c.admin_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/platform/accounts/${c.organization_id}`}>
                    <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Review & Assign Plan</Button>
                  </Link>
                  <Button size="sm" onClick={() => approveMutation.mutate(c.organization_id)} isLoading={approveMutation.isPending}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Quick Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Accounts table */}
      <Card title="All Accounts">
        {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : (
          <DataTable
            data={customers as any[]}
            columns={columns}
            rowKey={(account) => account.organization_id}
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

      {/* Quick view modal */}
      <Modal isOpen={!!viewOrg} onClose={() => setViewOrg(null)} title="Organization Details" size="lg">
        {viewOrg && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-slate-400">Name</p><p className="font-semibold">{viewOrg.display_name}</p></div>
              <div><p className="text-xs text-slate-400">Admin email</p><p className="font-semibold">{viewOrg.admin_email}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><Badge label={viewOrg.account_status} variant={viewOrg.account_status === "active" ? "green" : "rose"} /></div>
              <div><p className="text-xs text-slate-400">Package</p><p className="font-semibold">{viewOrg.current_plan_name ?? "None"}</p></div>
              <div><p className="text-xs text-slate-400">Users</p><p className="font-semibold">{viewOrg.users_count ?? 0}</p></div>
              <div><p className="text-xs text-slate-400">Events</p><p className="font-semibold">{viewOrg.events_count ?? 0}</p></div>
              <div><p className="text-xs text-slate-400">Revenue</p><p className="font-semibold text-emerald-700">{formatTZS(viewOrg.total_revenue_tsh)}</p></div>
              <div><p className="text-xs text-slate-400">Last activity</p><p className="font-semibold">{formatDate(viewOrg.last_activity_at)}</p></div>
            </div>
            <div className="flex justify-end gap-2">
              {viewOrg.account_status === "pending_review" && (
                <Button size="sm" onClick={() => { approveMutation.mutate(viewOrg.organization_id); setViewOrg(null); }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              )}
              <Link href={`/platform/accounts/${viewOrg.organization_id}`}>
                <Button size="sm" variant="outline" onClick={() => setViewOrg(null)}>
                  <Pencil className="h-3.5 w-3.5" /> Full profile & manage →
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Organization" size="sm">
        <p className="text-sm text-slate-600">This will permanently delete this organization, all its events, guests and data. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} isLoading={deleteMutation.isPending}>Delete permanently</Button>
        </div>
      </Modal>

      {/* Create organization modal */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); resetCreateForm(); }} title="New Organization" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Organization name *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Serengeti Events Ltd" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Admin email *" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" required />
            <Input label="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+255 7XX XXX XXX" />
          </div>
          <Input label="Billing email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="billing@example.com" />

          {/* Admin assignment */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">Account Admin</label>
            <div className="grid grid-cols-3 gap-2">
              {ADMIN_OPTIONS.map(({ key, label, hint, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setAdminMode(key)}
                  className={cn("rounded-lg border p-3 text-left text-xs transition", adminMode === key ? "border-gold-400 bg-gold-50" : "border-slate-200 hover:border-gold-300")}>
                  <Icon className="mb-1 h-4 w-4 text-gold-600" />
                  <p className="font-semibold text-slate-800">{label}</p>
                  <p className="text-[10px] text-slate-500">{hint}</p>
                </button>
              ))}
            </div>
          </div>
          {adminMode === "new" && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Input label="Full name *" value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} required />
              <Input label="Password *" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
            </div>
          )}
          {adminMode === "existing" && (
            <Select label="Select existing user" value={existingUserId} onChange={(e) => setExistingUserId(e.target.value)}>
              <option value="">— Pick a user —</option>
              {assignableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.email}) — {ROLE_LABELS[u.role] ?? u.role}</option>
              ))}
            </Select>
          )}

          <label className="flex items-center gap-3">
            <input type="checkbox" name="auto_approve" className="h-4 w-4 rounded accent-gold-500" />
            <span className="text-sm font-medium text-slate-700">Auto-approve account (skip pending review)</span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create organization</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
