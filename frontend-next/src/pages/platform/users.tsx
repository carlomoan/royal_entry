"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Edit2, Trash2, Loader2, Building2, Unlink, Link2, Globe, Ban } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { UserProfileModal } from "@/components/modals/UserProfileModal";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin", platform_admin: "Platform Admin", system_admin: "System Admin",
  account_admin: "Account Admin", event_manager: "Event Manager", event_accountant: "Event Accountant",
  secretary: "Secretary", scanner_attendant: "Scanner Attendant", viewer: "Viewer",
};
const PLATFORM_ROLES = ["superadmin", "platform_admin", "system_admin"];
const ACCOUNT_ROLES = ["account_admin", "event_manager", "event_accountant", "secretary", "scanner_attendant", "viewer"];

export default function UsersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [assignUser, setAssignUser] = useState<any | null>(null); // assign/remove modal
  const [profileUser, setProfileUser] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [sortField, setSortField] = useState<string>("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["platform-users"],
    queryFn: async () => (await api.get("/platform/users")).data.data,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: async () => (await api.get("/platform/customers")).data.data,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/platform/users", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-users"] }); setCreateOpen(false); toast.success("User created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed to create user (account users must be assigned to an organization)"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/users/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-users"] }); setEditUser(null); toast.success("User updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-users"] }); setDeleteConfirm(null); toast.success("User deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  // Assign or remove a user from an account
  const assignMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/users/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-users"] }); setAssignUser(null); toast.success("User account updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const role = (f.elements.namedItem("role") as HTMLSelectElement).value;
    createMutation.mutate({
      organization_id: (f.elements.namedItem("organization_id") as HTMLSelectElement).value || undefined,
      email: (f.elements.namedItem("email") as HTMLInputElement).value,
      password: (f.elements.namedItem("password") as HTMLInputElement).value,
      full_name: (f.elements.namedItem("full_name") as HTMLInputElement).value,
      phone: (f.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      role,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editUser) return;
    const f = e.currentTarget;
    const payload: any = {
      role: (f.elements.namedItem("role") as HTMLSelectElement).value || undefined,
      is_active: (f.elements.namedItem("is_active") as HTMLInputElement).checked,
      full_name: (f.elements.namedItem("full_name") as HTMLInputElement).value || undefined,
      phone: (f.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      email: (f.elements.namedItem("email") as HTMLInputElement).value || undefined,
    };
    updateMutation.mutate({ id: editUser.id, payload });
  };

  const handleAssign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assignUser) return;
    const f = e.currentTarget;
    const orgSel = f.elements.namedItem("organization_id") as HTMLSelectElement;
    const roleSel = f.elements.namedItem("role") as HTMLSelectElement;
    const orgValue = orgSel.value;
    assignMutation.mutate({
      id: assignUser.id,
      payload: {
        organization_id: orgValue || null,
        role: roleSel.value || undefined,
      },
    });
  };

  const filteredUsers = users.filter((u: any) => {
    const matchesSearch = !searchQuery ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !filterRole || u.role === filterRole;
    const matchesAccount = !filterAccount || (filterAccount === "global" ? PLATFORM_ROLES.includes(u.role) : (filterAccount === "unassigned" ? !u.organization_id : u.organization_id === filterAccount));
    const matchesStatus = !filterStatus || (filterStatus === "active" ? u.is_active : (filterStatus === "suspended" ? !u.is_active : true));
    return matchesSearch && matchesRole && matchesAccount && matchesStatus;
  }).sort((a: any, b: any) => {
    const aVal = (a[sortField] ?? "").toString().toLowerCase();
    const bVal = (b[sortField] ?? "").toString().toLowerCase();
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUsers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredUsers.map((u: any) => u.id)));
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    Array.from(selectedIds).forEach((id) => deleteMutation.mutate(id));
    setSelectedIds(new Set());
  };

  const bulkSuspend = () => {
    if (selectedIds.size === 0) return;
    Array.from(selectedIds).forEach((id) => {
      api.put(`/platform/users/${id}`, { is_active: false }).then(() => qc.invalidateQueries({ queryKey: ["platform-users"] }));
    });
    setSelectedIds(new Set());
    toast.success(`Suspended ${selectedIds.size} user(s)`);
  };

  const bulkAssign = () => {
    if (selectedIds.size === 0) return;
    toast(`Assign ${selectedIds.size} user(s) — use individual Assign button or open bulk-assign modal`, { icon: 'ℹ️' });
  };

  const removeFromAccount = (id: string) => {
    assignMutation.mutate({ id, payload: { organization_id: null } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Users</h1>
          <p className="text-sm text-slate-500">
            Manage users and assign them to accounts. Only superadmin & system_admin see the global view.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add user</Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex-1 min-w-[220px]">
          <Input
            label="Search"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-40"><Select label="Role" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All roles</option>
          {[...PLATFORM_ROLES, ...ACCOUNT_ROLES].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select></div>
        <div className="w-44"><Select label="Account" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}>
          <option value="">All accounts</option>
          <option value="global">Global (platform)</option>
          <option value="unassigned">Unassigned</option>
          {customers.map((c: any) => <option key={c.organization_id} value={c.organization_id}>{c.display_name}</option>)}
        </Select></div>
        <div className="w-32"><Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select></div>
        <div className="w-40"><Select label="Sort by" value={sortField} onChange={(e) => setSortField(e.target.value)}>
          <option value="full_name">Name</option>
          <option value="email">Email</option>
          <option value="role">Role</option>
          <option value="is_active">Status</option>
          <option value="created_at">Joined</option>
        </Select></div>
        <Button variant="outline" size="sm" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
          {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setFilterRole(""); setFilterAccount(""); setFilterStatus(""); setSortField("full_name"); setSortDir("asc"); setSelectedIds(new Set()); }}>Reset</Button>
      </div>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-navy-950 px-4 py-2.5 text-white shadow-md animate-fadeIn">
          <span className="text-xs font-semibold">{selectedIds.size} selected</span>
          <div className="mx-2 h-4 w-px bg-white/20" />
          <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={bulkDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={bulkSuspend}><Ban className="h-3.5 w-3.5" /> Suspend</Button>
          <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={bulkAssign}><Link2 className="h-3.5 w-3.5" /> Assign</Button>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : users.length === 0 ? (
        <Card><div className="py-12 text-center"><Users className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No users yet</p></div></Card>
      ) : (
        <Card title={`All Users (${filteredUsers.length}${filteredUsers.length !== users.length ? ` of ${users.length}` : ""})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded accent-gold-500"
                    aria-label="Select all"
                  />
                </th>
                {["Name", "Email", "Account", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u: any) => {
                  const isPlatform = PLATFORM_ROLES.includes(u.role);
                  const isSelected = selectedIds.has(u.id);
                  return (
                    <tr key={u.id} className={`transition ${isSelected ? "bg-gold-50/40" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(u.id)}
                          className="h-4 w-4 rounded accent-gold-500"
                          aria-label={`Select ${u.full_name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setProfileUser(u)} className="font-medium text-slate-900 transition hover:text-gold-700 hover:underline" title="View user profile">
                          {u.full_name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3">
                        {isPlatform ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
                            <Globe className="h-3 w-3" /> Global
                          </span>
                        ) : u.organization_name ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-1 text-xs font-medium text-gold-700">
                            <Building2 className="h-3 w-3" /> {u.organization_name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            <Unlink className="h-3 w-3" /> Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge label={ROLE_LABELS[u.role] ?? u.role} variant={isPlatform ? "gold" : "blue"} /></td>
                      <td className="px-4 py-3"><Badge label={u.is_active ? "active" : "suspended"} variant={u.is_active ? "green" : "rose"} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setAssignUser(u)} title="Assign to account" className="rounded p-1 text-sky-600 hover:bg-sky-50"><Link2 className="h-4 w-4" /></button>
                          <button onClick={() => setEditUser(u)} className="rounded p-1 text-gold-700 hover:bg-gold-50"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteConfirm(u.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No users match the current filters.</p>
            )}
          </div>
        </Card>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add User" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" name="email" type="email" required />
            <Input label="Full name" name="full_name" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Role" name="role" required>
              <option value="">Select role</option>
              {[...PLATFORM_ROLES, ...ACCOUNT_ROLES].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
            <Select label="Account" name="organization_id">
              <option value="">No account (platform roles only)</option>
              {customers.map((c: any) => <option key={c.organization_id} value={c.organization_id}>{c.display_name}</option>)}
            </Select>
          </div>
          <Input label="Phone" name="phone" />
          <Input label="Password" name="password" type="password" required />
          <p className="text-xs text-slate-400">
            Superadmin & system_admin have no account (global view). Other users must be assigned to an account and given a role.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Assign/Remove account modal */}
      <Modal isOpen={!!assignUser} onClose={() => setAssignUser(null)} title={assignUser ? `Manage Account: ${assignUser.full_name}` : ""} size="lg">
        {assignUser && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Assign <strong>{assignUser.email}</strong> to an account with a role, or remove them from their account.
            </p>
            <form onSubmit={handleAssign} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Account" name="organization_id" defaultValue={assignUser.organization_id ?? ""}>
                  <option value="">— No account —</option>
                  {customers.map((c: any) => <option key={c.organization_id} value={c.organization_id}>{c.display_name}</option>)}
                </Select>
                <Select label="Role" name="role" defaultValue={assignUser.role}>
                  {ACCOUNT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => setAssignUser(null)}>Cancel</Button>
                <Button type="submit" isLoading={assignMutation.isPending}><Link2 className="h-4 w-4" /> Save assignment</Button>
              </div>
            </form>

            {assignUser.organization_id && (
              <div className="border-t border-slate-100 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => removeFromAccount(assignUser.id)}
                  isLoading={assignMutation.isPending}
                  className="w-full text-rose-600"
                >
                  <Unlink className="h-4 w-4" /> Remove from current account
                </Button>
                <p className="mt-2 text-xs text-slate-400">
                  Removed user will only be able to view their profile until reassigned.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="lg">
        {editUser && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Full name" name="full_name" defaultValue={editUser.full_name} />
            <Input label="Email" name="email" type="email" defaultValue={editUser.email} />
            <Input label="Phone" name="phone" defaultValue={editUser.phone ?? ""} />
            <Select label="Role" name="role" defaultValue={editUser.role}>
              {[...PLATFORM_ROLES, ...ACCOUNT_ROLES].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="is_active" defaultChecked={editUser.is_active} className="h-4 w-4 rounded accent-gold-500" />
              <span className="text-sm font-medium text-slate-700">Account active</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete User" size="sm">
        <p className="text-sm text-slate-600">Delete this user? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>

      {/* User profile modal */}
      {profileUser && (
        <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
      )}
    </div>
  );
}