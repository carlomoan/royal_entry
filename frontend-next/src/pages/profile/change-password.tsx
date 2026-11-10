"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Save, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function ChangePasswordPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-me"] });
      toast.success("Password changed — please sign in with your new password");
      // Re-authenticate so the forced-change flag is cleared on the next login.
      setTimeout(() => logout(), 800);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? "Failed to change password"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Change your password</h1>
            <p className="text-sm text-slate-500">For your security, please set a new password.</p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Your account was created with a default password. You must change it before continuing.</span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" required />
          <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <Button type="submit" size="lg" className="w-full" isLoading={mutation.isPending}>
            <Save className="h-4 w-4" /> Change password
          </Button>
        </form>
      </Card>
    </div>
  );
}