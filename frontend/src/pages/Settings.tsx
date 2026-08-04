// src/pages/Settings.tsx
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Users,
  Plus,
  Loader2,
  Building2,
  Mail,
  Phone,
  Save,
  Settings as SettingsIcon,
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
  isPlatformAdmin,
  roleLabel,
  allowedAssignableRoles,
} from "@/utils/roles";
import type {
  TeamMember,
  CreateAccountUserInput,
  UpdateAccountUserInput,
} from "@/types";

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canManageUsers(user?.role);
  const isPlatform = isPlatformAdmin(user?.role);

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

      {isPlatform && <SystemSettingsCard />}

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
                {isPlatform
                  ? "Platform administrators can view system settings but don't belong to a specific organization."
                  : "Your account is not associated with an organization. Contact your administrator."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileRow
              icon={Building2}
              label="Display name"
              value={org.display_name}
            />
            <ProfileRow
              icon={Building2}
              label="Account slug"
              value={org.account_slug ?? "—"}
            />
            <ProfileRow
              icon={Mail}
              label="Billing email"
              value={org.billing_email ?? "—"}
            />
            <ProfileRow
              icon={Phone}
              label="Contact phone"
              value={org.contact_phone ?? "—"}
            />
            <ProfileRow
              icon={ShieldCheck}
              label="Created at"
              value={formatDate(org.created_at)}
            />
            <ProfileRow
              icon={ShieldCheck}
              label="Updated at"
              value={formatDate(org.updated_at)}
            />
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
                  {["Name", "Email", "Role", "Status", "Joined", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {team.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.full_name}
                      {m.id === user?.id && (
                        <span className="ml-2 text-xs text-gold-600">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.email}</td>
                    <td className="px-4 py-3">
                      <Badge label={roleLabel(m.role)} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={m.is_active ? "active" : "suspended"}
                        variant={m.is_active ? "green" : "rose"}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(m.created_at)}
                    </td>
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

function SystemSettingsCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => settingsApi.getSystem(),
  });

  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (data) {
      setDraft(JSON.stringify(data, null, 2));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      settingsApi.updateSystemSettings(settings),
    onSuccess: () => {
      toast.success("System settings updated");
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to update system settings";
      toast.error(msg);
    },
  });

  const handleSave = () => {
    try {
      const parsed = JSON.parse(draft);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        toast.error("Settings must be a JSON object");
        return;
      }
      saveMutation.mutate(parsed as Record<string, unknown>);
    } catch {
      toast.error("Invalid JSON");
    }
  };

  return (
    <Card
      title="System settings (platform)"
      action={
        <Button
          size="sm"
          onClick={handleSave}
          isLoading={saveMutation.isPending}
          disabled={isLoading}
        >
          <Save className="h-4 w-4" /> Save
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50/60 p-3 text-xs text-gold-800">
          <SettingsIcon className="h-4 w-4" /> Platform-wide configuration
          shared across all tenants.
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading system
            settings…
          </div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={12}
            className="w-full rounded-xl border border-gray-300 bg-white p-4 font-mono text-xs text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-gold-400"
          />
        )}
      </div>
    </Card>
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
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-50 text-gold-600 ring-1 ring-gold-200">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
          {value}
        </p>
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
      toast.error("Email, full name and password are required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
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
        <Input
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+255700000000"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min. 8 characters"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none transition focus:border-transparent focus:ring-2 focus:ring-gold-400"
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} isLoading={isSubmitting}>
            Add member
          </Button>
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
  const [role, setRole] = useState(
    member?.role ?? assignableRoles[0] ?? "viewer"
  );
  const [isActive, setIsActive] = useState(member?.is_active ?? true);
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");

  if (!member) return null;

  const submit = () => {
    onSubmit({
      role,
      is_active: isActive,
      full_name: fullName || undefined,
      phone: phone || undefined,
    });
  };

  return (
    <Modal
      isOpen={!!member}
      onClose={onClose}
      title={`Manage ${member.full_name}`}
      size="lg"
    >
      <div className="space-y-4">
        <Input
          label="Email"
          value={member.email}
          disabled
          hint="Email cannot be changed"
        />
        <Input
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+255700000000"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none transition focus:border-transparent focus:ring-2 focus:ring-gold-400"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              value={isActive ? "active" : "suspended"}
              onChange={(e) => setIsActive(e.target.value === "active")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none transition focus:border-transparent focus:ring-2 focus:ring-gold-400"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={submit} isLoading={isSubmitting}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
