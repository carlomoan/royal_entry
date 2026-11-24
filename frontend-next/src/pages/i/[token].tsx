"use client";
// ==============================================================================
// Public invitation page (/i/<token>) — QR-free, safe to forward. Shows the
// invitation card, event details, pledge/payment instructions and parking.
// ==============================================================================
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import {
  ArrowLeft, CalendarDays, MapPin, Clock, Heart, Wallet, CarFront,
  Printer, Loader2, AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { Button, Card, Badge } from "@/components/ui";

export default function PublicInvitationPage() {
  const router = useRouter();
  const token = router.query.token as string | undefined;
  const qc = useQueryClient();
  const [pledgeAmount, setPledgeAmount] = useState("");

  const pledgeMutation = useMutation({
    mutationFn: (amount: number) =>
      api.post(`/public/invitations/${encodeURIComponent(token!)}/pledge`, { pledged_amount: amount }),
    onSuccess: (r: any) => {
      toast.success(r.data.data?.message ?? "Pledge confirmed");
      setPledgeAmount("");
      qc.invalidateQueries({ queryKey: ["public-invitation-card", token] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? "Could not confirm pledge"),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-invitation-card", token],
    queryFn: async () =>
      (await api.get(`/public/invitations/${encodeURIComponent(token!)}/card`)).data.data,
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <h1 className="text-lg font-bold text-slate-900">Invitation not found</h1>
          <p className="mt-1 text-sm text-slate-500">This link may have expired or is invalid.</p>
        </Card>
      </div>
    );
  }

  const fmtDate = (value: string) => {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const guestClass = String(data.guest_category ?? "").trim().toLowerCase();
  const isMyClass = (variant: { class_name?: string }) =>
    !!guestClass && String(variant.class_name ?? "").trim().toLowerCase() === guestClass;
  const parkingVariants: { class_name: string; instructions: string }[] =
    Array.isArray(data.parking_variants) ? data.parking_variants : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gold-50/30 print:bg-white">
      <div className="mx-auto max-w-2xl px-4 py-8 print:p-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-gold-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print / Save PDF
          </Button>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="bg-navy-950 px-8 py-8 text-center text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-400">RoyalEntry</p>
            <h1 className="mt-3 text-3xl font-black">You&apos;re Invited</h1>
            <p className="mt-1 text-lg font-semibold text-gold-400">{data.title}</p>
          </div>

          <div className="space-y-5 p-8">
            <p className="text-slate-700">
              Dear <strong>{data.guest_name}</strong>, we are delighted to invite you to{" "}
              <strong>{data.title}</strong>. We look forward to celebrating together.
            </p>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3 text-sm">
                <CalendarDays className="h-4 w-4 text-gold-600" />
                <span className="font-semibold text-slate-800">{fmtDate(data.event_date)}</span>
              </div>
              {data.event_time && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-gold-600" />
                  <span className="text-slate-700">{data.event_time}</span>
                </div>
              )}
              {data.venue && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-gold-600" />
                  <span className="text-slate-700">{data.venue}{data.venue_address ? ` · ${data.venue_address}` : ""}</span>
                </div>
              )}
              {data.guest_category && (
                <div className="flex items-center gap-3 text-sm">
                  <Badge label={data.guest_category} variant="gold" />
                  <span className="text-xs text-slate-500">Party size: {data.party_size ?? 1}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gold-200 bg-gold-50/50 p-5">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-gold-700" />
                <h2 className="font-bold text-slate-900">Support the event</h2>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                You are welcome to make a pledge (michango) towards this event. Your contribution makes the celebration possible.
              </p>
              {(data.min_pledge_per_person || data.min_pledge_plus_one) && (
                <div className="mt-3 rounded-lg bg-white/70 p-3 text-sm">
                  <p className="font-semibold text-slate-800">Suggested minimum</p>
                  <p className="text-slate-600">
                    Per person: {data.min_pledge_per_person ? `TZS ${Number(data.min_pledge_per_person).toLocaleString()}` : "—"}
                    {data.min_pledge_plus_one ? ` · Plus-one: TZS ${Number(data.min_pledge_plus_one).toLocaleString()}` : ""}
                  </p>
                </div>
              )}
              {data.payment_instructions && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 p-3 text-sm text-slate-700">
                  <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-700" />
                  <p className="whitespace-pre-wrap">{data.payment_instructions}</p>
                </div>
              )}
              <form
                className="mt-4 rounded-lg border border-gold-200 bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const amount = Number(pledgeAmount);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    toast.error("Enter a valid pledge amount");
                    return;
                  }
                  pledgeMutation.mutate(Math.round(amount));
                }}
              >
                <label htmlFor="pledge-amount" className="block text-sm font-semibold text-slate-800">
                  Confirm your pledge (TZS)
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="pledge-amount"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={pledgeAmount}
                    onChange={(e) => setPledgeAmount(e.target.value)}
                    placeholder={String(data.min_pledge_per_person ?? 50000)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-100"
                  />
                  <Button type="submit" size="sm" isLoading={pledgeMutation.isPending}>
                    <Heart className="mr-1 h-4 w-4" /> Confirm pledge
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  You can change this before any payment is recorded. The family reviews your check-in card after confirmation.
                </p>
              </form>
            </div>

            {data.parking_instructions && (
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <CarFront className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-600" />
                <p className="whitespace-pre-wrap">{data.parking_instructions}</p>
              </div>
            )}

            {parkingVariants.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <CarFront className="h-4 w-4 text-gold-600" />
                  <h2 className="font-bold text-slate-900">Parking by class</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {[...parkingVariants]
                    .sort((a, b) => Number(isMyClass(b)) - Number(isMyClass(a)))
                    .map((variant, index) => (
                      <div
                        key={`${variant.class_name}-${index}`}
                        className={`rounded-lg border p-3 text-sm ${
                          isMyClass(variant)
                            ? "border-gold-400 bg-gold-50 text-slate-800"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-wrap">
                            <strong className="font-semibold text-navy-950">{variant.class_name}</strong>
                            {" — "}{variant.instructions}
                          </p>
                          {isMyClass(variant) && <Badge label="Your class" variant="gold" />}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-slate-400">
              This invitation has no entry rights. Your check-in card becomes available after your pledge is confirmed or approved.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}