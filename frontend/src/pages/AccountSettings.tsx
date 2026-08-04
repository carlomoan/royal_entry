// ==============================================================================
// FILE: src/pages/AccountSettings.tsx
// ==============================================================================
// Account-scoped settings page. Shows organization profile, team members, roles.
// Platform admins use /platform/settings for system settings instead.
// ==============================================================================
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Users,
  Plus,
  Loader2,
  Building2,
  Mail,
  Phone,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { settingsApi } from "@/api/settings";
import { useAuth } from "@/context/useAuth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { formatDate } from "@/utils/format";
import {
  canManageUsers,
  roleLabel,
  allowedAssignableRoles,
} from "@/utils/roles";
import type {
  TeamMember,
  CreateAccountUserInput,
  UpdateAccountUserInput,
} from "@/types";

export default function AccountSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canManageUsers(user?.role);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => settingsApi.getAccount(),
    retry: 1,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);

  const org = data?.organization;
  const team = data?.users ?? [];
  const assignableRoles = allowedAssignableRoles(user?.role);

  const createMutation = useMutation({
    mutationFn: (payload: CreateAccountUserInput) =>
      settingsApi.createUser(payload),
    onSuccess: () => {
      toast.success("Team member added");
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      setCreateOpen(false);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to add team member";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateAccountUserInput;
    }) => settingsApi.updateUser(id, payload),
    onSuccess: () => {
      toast.success("Team member updated");
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      setEditTarget(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to update team member";
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your organization profile, team members and their roles.
        </p>
      </div>

      <Card title="Organization">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading organization…
          </div>
        ) : isError ? (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-900">
                Unable to load organization
              </p>
              <p className="text-xs text-rose-700 mt-1">
                {error instanceof Error
                  ? error.message
                  : "You may not have access to organization settings."}
              </p>
            </div>
          </div>
        ) : !org ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                No organization assigned
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Your account is not associated with an organization. Contact your
                administrator.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileRow icon={Building2} label="Display name" value={org.display_name} />
            <ProfileRow icon={Building2} label="Account slug" value={org.account_slug ?? "—"} />
            <ProfileRow icon={Mail} label="Billing email" value={org.billing_email ?? "—"} />
            <ProfileRow icon={Phone} label="Contact phone" value={org.contact_phone ?? "—"} />
            <ProfileRow icon={ShieldCheck} label="Created at" value={formatDate(org.created_at)} />
            <ProfileRow icon={ShieldCheck} label="Updated at" value={formatDate(org.updated_at)} />
          </div>
        )}
      </Card>

      <Card
        title="Team & roles"
        action={
          canManage ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Add member
            </Button>
          ) : null
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
          </div>
        ) : team.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">No team members yet</p>
            {canManage && (
              <p className="text-xs text-slate-500 mt-1">
                Click "Add member" to invite your first team member.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Team members list">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Name", "Email", "Role", "Status", "Joined", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {team.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.full_name}
                      {m.id === user?.id && (
                        <span className="ml-2 text-xs text-gold-600">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.email}</td>
                    <td className="px-4 py-3"><Badge label={roleLabel(m.role)} /></td>
                    <td className="px-4 py-3">
                      <Badge label={m.is_active ? "active" : "suspended"} variant={m.is_active ? "green" : "rose"} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {canManage && m.id !== user?.id && (
                        <button
                          onClick={() => setEditTarget(m)}
                          className="text-xs font-semibold text-gold-700 hover:text-gold-800"
                        >
                          Manage
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!canManage && team.length > 0 && (
          <p className="mt-4 text-xs text-slate-600">
            Only account administrators can add or modify team members.
          </p>
        )}
      </Card>

      <CreateMemberModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        assignableRoles={assignableRoles}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />

      <EditMemberModal
        key={editTarget?.id}
        member={editTarget}
        assignableRoles={assignableRoles}
        onClose={() => setEditTarget(null)}
        onSubmit={(payload) =>
          editTarget && updateMutation.mutate({ id: editTarget.id, payload })
        }
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function CreateMemberModal({
  isOpen,
  onClose,
  assignableRoles,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  assignableRoles: string[];
  onSubmit: (payload: CreateAccountUserInput) => void;
  isSubmitting: boolean;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(assignableRoles[0] ?? "viewer");

  const submit = () => {
    if (!email || !fullName || !password) {
      toast.error("Email, name and password are required");
      return;
    }
    onSubmit({
      email,
      full_name: fullName,
      phone: phone || undefined,
      password,
      role,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add team member" size="lg">
      <div className="space-y-4">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255700000000" />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set initial password" />
        <div>
          <label className="text-xs font-semibold text-slate-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={submit} isLoading={isSubmitting}>Add member</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditMemberModal({
  member,
  assignableRoles,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  member: TeamMember | null;
  assignableRoles: string[];
  onClose: () => void;
  onSubmit: (payload: UpdateAccountUserInput) => void;
  isSubmitting: boolean;
}) {
  const [role, setRole] = useState(member?.role ?? "");
  const [isActive, setIsActive] = useState(member?.is_active ?? true);
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");

  const submit = () => {
    if (!member) return;
    onSubmit({
      role: role || undefined,
      is_active: isActive,
      full_name: fullName || undefined,
      phone: phone || undefined,
    });
  };

  if (!member) return null;

  return (
    <Modal isOpen={!!member} onClose={onClose} title={`Manage: ${member.full_name}`} size="lg">
      <div className="space-y-4">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div>
          <label className="text-xs font-semibold text-slate-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
          <span className="text-sm font-medium text-slate-700">Account active</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" onClick={submit} isLoading={isSubmitting}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}