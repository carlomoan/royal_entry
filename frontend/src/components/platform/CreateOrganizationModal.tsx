// src/components/platform/CreateOrganizationModal.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, User, CreditCard, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { platformApi, type CreateOrganizationPayload } from "@/api/platform";
import { formatTZS } from "@/utils/format";
import { cn } from "@/utils/cn";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateOrganizationModal({ isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [created, setCreated] = useState<{
    organization_id: string;
    admin_user_id: string;
  } | null>(null);

  // Organization fields
  const [displayName, setDisplayName] = useState("");
  const [accountSlug, setAccountSlug] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Admin user fields
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Package selection
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [autoApprove, setAutoApprove] = useState(true);

  const { data: plans = [] } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => platformApi.plans(),
    enabled: isOpen,
  });

  // Auto-generate slug from display name
  useEffect(() => {
    if (!accountSlug && displayName) {
      setAccountSlug(
        displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40),
      );
    }
  }, [displayName, accountSlug]);

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: CreateOrganizationPayload = {
        display_name: displayName.trim(),
        account_slug: accountSlug.trim() || undefined,
        billing_email: billingEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        admin: {
          email: adminEmail.trim(),
          full_name: adminName.trim(),
          phone: adminPhone.trim() || undefined,
          password: adminPassword,
        },
        plan_id: selectedPlanId || undefined,
        auto_approve: autoApprove,
      };
      return platformApi.createOrganization(payload);
    },
    onSuccess: (result) => {
      setCreated(result);
      setStep(3);
      qc.invalidateQueries({ queryKey: ["platform-customers"] });
      qc.invalidateQueries({ queryKey: ["platform-summary"] });
      toast.success("Organization created successfully");
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to create organization";
      toast.error(msg);
    },
  });

  const handleClose = () => {
    // Reset all state
    setStep(1);
    setCreated(null);
    setDisplayName("");
    setAccountSlug("");
    setBillingEmail("");
    setContactPhone("");
    setAdminName("");
    setAdminEmail("");
    setAdminPhone("");
    setAdminPassword("");
    setSelectedPlanId("");
    setAutoApprove(true);
    onClose();
  };

  const canProceedStep1 = displayName.trim().length >= 2;
  const canProceedStep2 =
    adminName.trim().length >= 2 &&
    adminEmail.includes("@") &&
    adminPassword.length >= 8;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create new organization"
      size="lg"
    >
      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition",
                step === s
                  ? "bg-gold-500 text-navy-950"
                  : step > s
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-500",
              )}
            >
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            <span
              className={cn(
                "text-xs font-semibold",
                step >= s ? "text-slate-900" : "text-slate-400",
              )}
            >
              {s === 1 ? "Organization" : s === 2 ? "Admin user" : "Package"}
            </span>
            {s < 3 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1",
                  step > s ? "bg-emerald-500" : "bg-slate-200",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Organization details */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
            <Building2 className="h-4 w-4" />
            Set up the organization profile. The admin user will be created in the next step.
          </div>
          <Input
            label="Organization name *"
            placeholder="e.g. Amina Events Ltd"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="Account slug"
            placeholder="amina-events"
            value={accountSlug}
            onChange={(e) => setAccountSlug(e.target.value)}
            hint="Used in URLs. Auto-generated from name if left empty."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Billing email"
              type="email"
              placeholder="billing@example.com"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
            />
            <Input
              label="Contact phone"
              placeholder="+255700000000"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
            >
              Next: Admin user
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Admin user */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-800">
            <User className="h-4 w-4" />
            Create the first account administrator. They can log in immediately after creation.
          </div>
          <Input
            label="Admin full name *"
            placeholder="Jane Doe"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Admin email *"
              type="email"
              placeholder="jane@example.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
            <Input
              label="Admin phone"
              placeholder="+255700000000"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
            />
          </div>
          <Input
            label="Initial password *"
            type="password"
            placeholder="min. 8 characters"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            hint="Share this securely with the admin. They can change it after first login."
          />
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!canProceedStep2}
            >
              Next: Package
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Package & confirmation */}
      {step === 3 && !created && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-gold-50 p-3 text-xs text-gold-800">
            <CreditCard className="h-4 w-4" />
            Assign a service plan. You can change this later from the customer detail page.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  selectedPlanId === plan.id
                    ? "border-gold-400 bg-gold-50/60 ring-2 ring-gold-200"
                    : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">{plan.name}</p>
                  {selectedPlanId === plan.id && (
                    <CheckCircle2 className="h-5 w-5 text-gold-600" />
                  )}
                </div>
                <p className="mt-1 text-lg font-black text-gold-700">
                  {formatTZS(plan.price_tsh)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {plan.description ?? plan.billing_interval}
                </p>
              </button>
            ))}
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-gold-500"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Auto-approve this organization
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Skip the 24-hour review queue. The admin can log in immediately.
              </p>
            </div>
          </label>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
            >
              Create organization
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 success state */}
      {step === 3 && created && (
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Organization created!
            </h3>
            <p className="mt-2 text-sm text-slate-600 max-w-sm">
              <strong>{displayName}</strong> is ready. The admin{" "}
              <strong>{adminEmail}</strong> can now sign in at{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                /login
              </code>
              .
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-500">Organization ID</dt>
                <dd className="font-mono text-xs text-slate-900">
                  {created.organization_id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Admin user ID</dt>
                <dd className="font-mono text-xs text-slate-900">
                  {created.admin_user_id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-semibold text-emerald-700">
                  {autoApprove ? "Approved" : "Pending review"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={handleClose}>
              View in customers list
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
