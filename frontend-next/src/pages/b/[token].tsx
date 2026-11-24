"use client";
// ==============================================================================
// Public booking registration page (/b/<token>) — no login required. The company
// contact verifies their email, then registers attendee names on unnamed passes.
// ==============================================================================
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import {
  AlertCircle, CheckCircle2, ClipboardList, Loader2, Mail,
  ShieldAlert, UserRound,
} from "lucide-react";
import api from "@/lib/api";
import { Badge, Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type BookingPass = {
  guest_id: string;
  full_name: string;
  pass_state: string;
  table_number?: string | null;
  package_name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type BookingInfo = {
  booking_id: string;
  company_name: string;
  contact_person: string;
  event_id: string;
  event_title: string;
  workflow_status: string;
  contact_email_verified: boolean;
  contact_email_is_free: boolean;
  passes: BookingPass[];
};

type PassEdit = { full_name: string; phone: string; email: string };
type NamePayload = {
  guest_id: string;
  full_name: string;
  phone: string;
  email?: string;
};

const GENERIC_NAME = /^(seat|unnamed|guest|attendee|pass|tbd|n\/a|-)\b/i;

function isEditablePass(pass: BookingPass): boolean {
  const name = (pass.full_name ?? "").trim();
  if (pass.pass_state === "unnamed") return true;
  if (pass.pass_state === "issued") {
    return !name || GENERIC_NAME.test(name) || /^\d+$/.test(name);
  }
  return false;
}

function passBadgeVariant(state: string): string {
  switch (state) {
    case "named":
    case "checked_in":
      return "green";
    case "revoked":
      return "rose";
    case "issued":
      return "blue";
    default:
      return "slate";
  }
}

export default function BookingRegistrationPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : undefined;
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, PassEdit>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<BookingInfo>({
    queryKey: ["public-booking", token],
    queryFn: async () =>
      (await api.get(`/public/bookings/${encodeURIComponent(token!)}`)).data.data,
    enabled: !!token,
    retry: 1,
  });

  useEffect(() => {
    if (!data?.passes) return;
    const next: Record<string, PassEdit> = {};
    for (const pass of data.passes) {
      if (isEditablePass(pass)) {
        next[pass.guest_id] = {
          full_name: pass.full_name ?? "",
          phone: pass.phone ?? "",
          email: pass.email ?? "",
        };
      }
    }
    setEdits(next);
  }, [data]);

  const registerMutation = useMutation({
    mutationFn: (passes: NamePayload[]) =>
      api.post(`/public/bookings/${encodeURIComponent(token!)}/names`, { passes }),
    onSuccess: (r: any) => {
      const named = r.data?.data?.named ?? 0;
      setSubmitError(null);
      toast.success(`${named} name${named === 1 ? "" : "s"} registered`);
      qc.invalidateQueries({ queryKey: ["public-booking", token] });
      refetch();
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error?.message ?? "Could not register names. Please try again.";
      setSubmitError(msg);
      toast.error(msg);
    },
  });

  if (!router.isReady || (isLoading && !data)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-6 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
        <p className="text-sm text-white/70">Loading booking details…</p>
      </div>
    );
  }

  if (!token || isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="mt-3 break-words text-xl font-bold text-navy-950">
            Invalid booking link
          </h1>
          <p className="mt-2 break-words text-sm text-slate-600">
            This link may have expired or is no longer valid. Please check with your organizer for a new one.
          </p>
        </div>
      </div>
    );
  }

  const passes = data.passes ?? [];
  const editablePasses = passes.filter(isEditablePass);
  const verified = !!data.contact_email_verified;
  const isDeadlineError = !!submitError && /deadline/i.test(submitError);

  const updateEdit = (guestId: string, field: keyof PassEdit, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [guestId]: {
        ...(prev[guestId] ?? { full_name: "", phone: "", email: "" }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const payload: NamePayload[] = editablePasses.map((pass) => {
      const edit = edits[pass.guest_id] ?? {
        full_name: pass.full_name ?? "",
        phone: pass.phone ?? "",
        email: pass.email ?? "",
      };
      return {
        guest_id: pass.guest_id,
        full_name: edit.full_name.trim(),
        phone: edit.phone.trim(),
        email: edit.email.trim() || undefined,
      };
    });
    if (payload.length === 0) {
      const msg = "There are no unnamed passes to register.";
      setSubmitError(msg);
      toast.error(msg);
      return;
    }
    if (payload.some((p) => !p.full_name || !p.phone)) {
      const msg = "Each attendee needs a full name and phone number.";
      setSubmitError(msg);
      toast.error(msg);
      return;
    }
    registerMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-400">RoyalEntry</p>
          <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">
            Register attendee names
          </h1>
        </div>

        <Card className="overflow-hidden p-0 shadow-2xl">
          <div className="bg-navy-950 px-5 py-6 text-white sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-xs font-semibold uppercase tracking-widest text-gold-400">
                  {data.event_title}
                </p>
                <h2 className="mt-1 break-words text-xl font-black sm:text-2xl">
                  {data.company_name}
                </h2>
                <p className="mt-2 flex items-center gap-2 break-words text-sm text-white/70">
                  <UserRound className="h-4 w-4 flex-shrink-0 text-gold-400" />
                  Contact: {data.contact_person}
                </p>
              </div>
              <Badge label={data.workflow_status} variant="gold" className="bg-white/10 text-gold-300" />
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-8">
            {!verified && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
                  <div className="min-w-0">
                    <h3 className="break-words font-bold text-rose-800">
                      Verify your email before registering names
                    </h3>
                    <p className="mt-1 break-words text-sm text-rose-700">
                      A verification link was emailed to your contact address. Ask your organizer to
                      send it if you haven&apos;t received it, then open that link and return here.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {data.contact_email_is_free && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                  <p className="break-words">
                    A free-mail address is used for this booking. Ask your organizer to confirm your identity.
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div
                className={cn(
                  "rounded-xl border p-4 text-sm font-semibold",
                  isDeadlineError
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <p className="break-words">
                    {isDeadlineError
                      ? "The name registration deadline has passed. Contact the organizer to register these names."
                      : submitError}
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 flex-shrink-0 text-gold-600" />
                <h3 className="break-words font-bold text-navy-950">
                  Your passes ({passes.length})
                </h3>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-3 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                  <span>Attendee</span>
                  <span>Phone</span>
                  <span>Email</span>
                  <span>Pass</span>
                </div>

                {passes.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    No passes have been added to this booking yet.
                  </p>
                )}

                {passes.map((pass, index) => {
                  const editable = isEditablePass(pass) && verified;
                  const edit = edits[pass.guest_id] ?? {
                    full_name: pass.full_name ?? "",
                    phone: pass.phone ?? "",
                    email: pass.email ?? "",
                  };
                  return (
                    <div
                      key={pass.guest_id}
                      className={cn(
                        "grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr_0.9fr] sm:items-center",
                        index > 0 && "border-t border-slate-100"
                      )}
                    >
                      <div className="min-w-0">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-400 sm:hidden">
                          Full name
                        </span>
                        {editable ? (
                          <Input
                            aria-label={`Full name for pass ${index + 1}`}
                            placeholder="Full name"
                            value={edit.full_name}
                            onChange={(e) => updateEdit(pass.guest_id, "full_name", e.target.value)}
                            disabled={registerMutation.isPending}
                            className="text-sm"
                          />
                        ) : (
                          <p className="break-words py-2 text-sm font-semibold text-slate-800">
                            {pass.full_name || "Attendee"}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-400 sm:hidden">
                          Phone
                        </span>
                        {editable ? (
                          <Input
                            aria-label={`Phone for pass ${index + 1}`}
                            placeholder="Phone"
                            value={edit.phone}
                            onChange={(e) => updateEdit(pass.guest_id, "phone", e.target.value)}
                            disabled={registerMutation.isPending}
                            className="text-sm"
                          />
                        ) : (
                          <p className="py-2 text-sm text-slate-400">—</p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-400 sm:hidden">
                          Email
                        </span>
                        {editable ? (
                          <Input
                            aria-label={`Email for pass ${index + 1}`}
                            type="email"
                            placeholder="Email (optional)"
                            value={edit.email}
                            onChange={(e) => updateEdit(pass.guest_id, "email", e.target.value)}
                            disabled={registerMutation.isPending}
                            className="text-sm"
                          />
                        ) : (
                          <p className="py-2 text-sm text-slate-400">—</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge label={pass.pass_state} variant={passBadgeVariant(pass.pass_state)} />
                        {pass.table_number && (
                          <span className="text-xs text-slate-500">Table {pass.table_number}</span>
                        )}
                        {pass.package_name && (
                          <span className="break-words text-xs text-slate-500">{pass.package_name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {verified && editablePasses.length > 0 && (
              <form onSubmit={handleSubmit}>
                <Button
                  type="submit"
                  size="lg"
                  isLoading={registerMutation.isPending}
                  className="w-full"
                >
                  <CheckCircle2 className="h-5 w-5" /> Register names
                </Button>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Named passes receive their check-in credentials by SMS and email.
                </p>
              </form>
            )}

            {verified && editablePasses.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                All passes on this booking have names registered.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
