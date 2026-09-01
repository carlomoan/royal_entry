"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldCheck, Plus, Edit2, Trash2, Loader2, KeyRound,
  Check, X, Globe, Building2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Badge, Button, Modal, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

const ROLE_SCOPE_LABELS: Record<string, string> = {
  platform: "Platform", account: "Account",
};

export default function RbacPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [createScope, setCreateScope] = useState("account");

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["platform-roles"],
    queryFn: async () => (await api.get("/platform/roles")).data.data,
  });
  const { data: permissions = [] } = useQuery({
    queryKey: ["platform-permissions"],
    queryFn: async () => (await api.get("/platform/permissions")).data.data,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/platform/roles", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-roles"] }); setCreateOpen(false); setSelectedPerms([]); toast.success("Role created"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.put(`/platform/roles/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-roles"] }); setEditRole(null); toast.success("Role updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-roles"] }); setDeleteConfirm(null); toast.success("Role deleted"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Failed"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    createMutation.mutate({
      code: (f.elements.namedItem("code") as HTMLInputElement).value.trim().toLowerCase().replace(/\s+/g, "_"),
      name: (f.elements.namedItem("name") as HTMLInputElement).value,
      description: (f.elements.namedItem("description") as HTMLInputElement).value || undefined,
      scope: createScope,
      permissions: selectedPerms,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editRole) return;
    const payload: any = { permissions: selectedPerms };
    // System roles can only have their permissions adjusted (name/description locked)
    if (!editRole.is_system) {
      payload.name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value;
      payload.description = (e.currentTarget.elements.namedItem("description") as HTMLInputElement).value || undefined;
    }
    updateMutation.mutate({ id: editRole.id, payload });
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  // Group permissions by resource
  const grouped = permissions.reduce((acc: any, perm: string) => {
    const resource = perm.split(":")[0];
    if (!acc[resource]) acc[resource] = [];
    acc[resource].push(perm);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles & Permissions</h1>
          <p className="text-sm text-slate-500">Create custom roles, assign permissions, and manage access</p>
        </div>
        <Button onClick={() => { setSelectedPerms([]); setCreateScope("account"); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Create role
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : roles.length === 0 ? (
        <Card><div className="py-12 text-center"><ShieldCheck className="mx-auto mb-3 h-10 w-10 text-slate-200" /><p className="font-medium text-slate-600">No roles</p></div></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {roles.map((role: any) => (
            <Card key={role.id} title={role.name} className="animate-fadeIn"
              action={
                <div className="flex items-center gap-1">
                  <Badge label={ROLE_SCOPE_LABELS[role.scope] ?? role.scope} variant={role.scope === "platform" ? "gold" : "blue"} />
                  {role.is_system && <Badge label="System" variant="slate" />}
                  <button onClick={() => { setEditRole(role); setSelectedPerms(role.permissions); }}
                    className="rounded p-1 text-gold-700 hover:bg-gold-50" title="Edit permissions">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(role.id)} disabled={role.is_system}
                    className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-30" title={role.is_system ? "System roles can't be deleted" : "Delete"}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              }
            >
              <p className="mb-3 text-xs text-slate-500">{role.description ?? "No description"}</p>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.length === 0 ? (
                  <span className="text-xs text-slate-400">No permissions assigned</span>
                ) : role.permissions.slice(0, 12).map((p: string) => (
                  <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{p}</span>
                ))}
                {role.permissions.length > 12 && <span className="text-[10px] text-slate-400">+{role.permissions.length - 12} more</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Role" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" name="name" required />
            <Input label="Code (auto: lowercase)" name="code" required />
          </div>
          <Input label="Description" name="description" />
          <Select label="Scope" value={createScope} onChange={(e) => setCreateScope(e.target.value)}>
            <option value="account">Account</option>
            <option value="platform">Platform</option>
          </Select>

          <PermissionPicker permissions={permissions} grouped={grouped as any} selected={selectedPerms} onToggle={togglePerm} />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal — system roles can edit permissions only */}
      <Modal isOpen={!!editRole} onClose={() => setEditRole(null)} title={editRole ? `Edit ${editRole.name}${editRole.is_system ? " (System)" : ""}` : ""} size="lg">
        {editRole && (
          <form onSubmit={handleUpdate} className="space-y-4">
            {!editRole.is_system && (
              <>
                <Input label="Name" name="name" defaultValue={editRole.name} required />
                <Input label="Description" name="description" defaultValue={editRole.description ?? ""} />
              </>
            )}
            {editRole.is_system && (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                This is a system role. You can adjust its permissions, but the name and description are fixed.
              </p>
            )}

            <PermissionPicker permissions={permissions} grouped={grouped as any} selected={selectedPerms} onToggle={togglePerm} />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditRole(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Role" size="sm">
        <p className="text-sm text-slate-600">Delete this role? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function PermissionPicker({ permissions, grouped, selected, onToggle }: any) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
        <KeyRound className="h-3.5 w-3.5" /> Permissions ({selected.length} selected)
      </label>
      <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 p-3">
        {Object.entries(grouped).map(([resource, perms]: any) => (
          <div key={resource} className="mb-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{resource}</p>
            <div className="flex flex-wrap gap-1.5">
              {perms.map((perm: string) => (
                <button
                  key={perm}
                  type="button"
                  onClick={() => onToggle(perm)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] transition",
                    selected.includes(perm)
                      ? "bg-gold-500 text-navy-950"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {perm}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}