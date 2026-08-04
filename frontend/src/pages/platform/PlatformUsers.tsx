// ==============================================================================
// FILE: src/pages/platform/PlatformUsers.tsx
// ==============================================================================
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { platformApi, type CreatePlatformUserPayload } from "@/api/platform";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { formatDate } from "@/utils/format";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  platform_admin: "Platform Admin",
  system_admin: "System Admin",
  account_admin: "Account Admin",
  event_manager: "Event Manager",
  event_accountant: "Event Accountant",
  secretary: "Secretary",
  scanner_attendant: "Scanner Attendant",
  viewer: "Viewer",
};

const PLATFORM_ROLES = ["superadmin", "platform_admin", "system_admin"];
const ACCOUNT_ROLES = ["account_admin", "event_manager", "event_accountant", "secretary", "scanner_attendant", "viewer"];

export default function PlatformUsers() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["platform-users"],
    queryFn: () => platformApi.listUsers(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["platform-customers"],
    queryFn: () => platformApi.customers(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePlatformUserPayload) => platformApi.createUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-users"] });
      toast.success("User created");
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to create user"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => platformApi.updateUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-users"] });
      toast.success("User updated");
      setEditUser(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to update user"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-users"] });
      toast.success("User deleted");
      setDeleteConfirm(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete user"),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload: CreatePlatformUserPayload = {
      organization_id: (form.elements.namedItem("organization_id") as HTMLSelectElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
      full_name: (form.elements.namedItem("full_name") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      role: (form.elements.namedItem("role") as HTMLSelectElement).value,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editUser) return;
    const form = e.currentTarget;
    const payload: any = {};
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    if (email) payload.email = email;
    const role = (form.elements.namedItem("role") as HTMLSelectElement).value;
    if (role) payload.role = role;
    payload.is_active = (form.elements.namedItem("is_active") as HTMLInputElement).checked;
    const fullName = (form.elements.namedItem("full_name") as HTMLInputElement).value;
    if (fullName) payload.full_name = fullName;
    const phone = (form.elements.namedItem("phone") as HTMLInputElement).value;
    if (phone) payload.phone = phone;
    updateMutation.mutate({ id: editUser.id, payload });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Users</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage users across all organizations.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add user
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading users…</p>
      ) : users.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">No users yet</p>
        </div>
      ) : (
        <Card title="All users">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Platform users">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Name", "Email", "Organization", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gold-700 bg-gold-50 px-2 py-1 rounded-full">
                        {u.organization_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={ROLE_LABELS[u.role] ?? u.role}
                        variant={PLATFORM_ROLES.includes(u.role) ? "gold" : "blue"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={u.is_active ? "active" : "suspended"} variant={u.is_active ? "green" : "rose"} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditUser(u)}
                          className="text-gold-700 hover:text-gold-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-800"
                          onClick={() => setDeleteConfirm(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create User Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add platform user" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select label="Organization" name="organization_id" required>
            <option value="">Select organization</option>
            {customers.map((c: any) => (
              <option key={c.organization_id} value={c.organization_id}>
                {c.display_name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Email" name="email" type="email" placeholder="user@example.com" required />
            <Input label="Full name" name="full_name" placeholder="Jane Doe" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone (optional)" name="phone" placeholder="+255700000000" />
            <Select label="Role" name="role" required>
              <option value="">Select role</option>
              {PLATFORM_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
              {ACCOUNT_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
          </div>
          <Input label="Password" name="password" type="password" placeholder="Min 8 characters" required />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create user"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit user" size="lg">
        {editUser && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input label="Full name" name="full_name" defaultValue={editUser.full_name} />
            <Input label="Email" name="email" type="email" defaultValue={editUser.email} />
            <Input label="Phone" name="phone" defaultValue={editUser.phone ?? ""} />
            <Select label="Role" name="role" defaultValue={editUser.role}>
              {PLATFORM_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
              {ACCOUNT_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="is_active" defaultChecked={editUser.is_active} className="h-4 w-4 rounded accent-gold-500" />
              <span className="text-sm font-medium text-slate-700">Account active</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete user" size="sm">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this user? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="rose" onClick={() => deleteMutation.mutate(deleteConfirm!)} isLoading={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}