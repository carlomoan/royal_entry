"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Building2, Mail, Phone, Users, Plus, Edit2, Trash2, Settings } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Select } from "@/components/ui";
import { formatDate } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin", platform_admin: "Platform Admin", system_admin: "System Admin",
  account_admin: "Account Admin", event_manager: "Event Manager", event_accountant: "Event Accountant",
  secretary: "Secretary", scanner_attendant: "Scanner Attendant", viewer: "Viewer",
};
const ACCOUNT_ROLES = ["account_admin", "event_manager", "event_accountant", "secretary", "scanner_attendant", "viewer"];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["account-settings"],
    queryFn: async () => (await api.get("/settings/account")).data.data,
  });

  const org = data?.organization;
  const settings = data?.settings ?? {};
  const users = data?.users ?? [];
  const roleCatalog = data?.role_catalog ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/settings/users", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["account-settings"] }); setCreateOpen(false); toast.success("User created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/settings/users/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["account-settings"] }); setEditUser(null); toast.success("User updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["account-settings"] }); setDeleteConfirm(null); toast.success("User deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    createMutation.mutate({
      email: (f.elements.namedItem("email") as HTMLInputElement).value,
      password: (f.elements.namedItem("password") as HTMLInputElement).value,
      full_name: (f.elements.namedItem("full_name") as HTMLInputElement).value,
      phone: (f.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      role: (f.elements.namedItem("role") as HTMLSelectElement).value,
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
    };
    updateMutation.mutate({ id: editUser.id, payload });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Organization profile, team members and roles</p>
      </div>

      {/* Organization info */}
      <Card title="Organization">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !org ? (
          <p className="text-sm text-slate-500">No organization assigned</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Row icon={Building2} label="Display name" value={org.display_name} />
            <Row icon={Building2} label="Account slug" value={org.account_slug ?? "—"} />
            <Row icon={Mail} label="Billing email" value={org.billing_email ?? "—"} />
            <Row icon={Phone} label="Contact phone" value={org.contact_phone ?? "—"} />
            <Row icon={ShieldCheck} label="Created" value={formatDate(org.created_at)} />
          </div>
        )}
      </Card>

      {/* Team members */}
      <Card title="Team Members" action={
        <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-3.5 w-3.5" /> Add member</Button>
      }>
        {users.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No team members yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u: any) => (
                  <tr key={u.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3"><Badge label={ROLE_LABELS[u.role] ?? u.role} variant="blue" /></td>
                    <td className="px-4 py-3"><Badge label={u.is_active ? "active" : "suspended"} variant={u.is_active ? "green" : "rose"} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditUser(u)} className="rounded p-1 text-gold-700 hover:bg-gold-50"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteConfirm(u.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Role catalog */}
      <Card title="Role Catalog">
        <div className="flex flex-wrap gap-2">
          {roleCatalog.map((r: any) => (
            <Badge key={r.key} label={r.label} variant={r.scope === "platform" ? "gold" : "blue"} />
          ))}
        </div>
      </Card>

      {/* System settings */}
      <Card title="System Settings">
        <div className="grid max-w-lg gap-4">
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <span className="font-medium text-slate-500">{key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
              <span className="font-semibold text-slate-900">{value?.toString() ?? "—"}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Create user modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Team Member" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" name="email" type="email" required />
            <Input label="Full name" name="full_name" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Role" name="role" required>
              <option value="">Select role</option>
              {ACCOUNT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </div>
          <Input label="Phone" name="phone" />
          <Input label="Password" name="password" type="password" required />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit user modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit Team Member" size="lg">
        {editUser && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Full name" name="full_name" defaultValue={editUser.full_name} />
            <Input label="Email" name="email" type="email" defaultValue={editUser.email} />
            <Input label="Phone" name="phone" defaultValue={editUser.phone ?? ""} />
            <Select label="Role" name="role" defaultValue={editUser.role}>
              {ACCOUNT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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

      {/* Delete user modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Team Member" size="sm">
        <p className="text-sm text-slate-600">Delete this team member? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm"><Icon className="h-4 w-4 text-slate-500" /></div>
      <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="text-sm font-semibold text-slate-900">{value}</p></div>
    </div>
  );
}
