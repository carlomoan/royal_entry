// ==============================================================================
// FILE: src/pages/Scanner.tsx
// ==============================================================================
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  QrCode,
  ScanLine,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { eventsApi } from "@/api/events";
import { scannerApi } from "@/api/scanner";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { ScanCheckInResult } from "@/types";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/utils/cn";

export default function Scanner() {
  const { id: eventId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const initialCode = searchParams.get("code") ?? "";
  const [scanValue, setScanValue] = useState(initialCode);
  const [notes, setNotes] = useState("");
  const [scanSource, setScanSource] = useState("qr");
  const [lastResult, setLastResult] = useState<ScanCheckInResult | null>(null);

  // CHANGE: Replaced autoSubmittedCode with submittedCode to track local state safely
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!initialCode || !eventId) return;

    // Only submit if we haven't already submitted this code
    if (submittedCode !== initialCode) {
      setSubmittedCode(initialCode);
      checkInMutation.mutate(initialCode);
    }
  }, [initialCode, eventId]); // Removed submittedCode from deps to prevent re-triggering

  const { data: eventSummary } = useQuery({
    queryKey: ["event-summary", eventId],
    queryFn: () => eventsApi.summary(eventId!),
    enabled: !!eventId,
    refetchInterval: 15_000,
  });

  const { data: scanStats } = useQuery({
    queryKey: ["scan-stats", eventId],
    queryFn: () => scannerApi.stats(eventId!),
    enabled: !!eventId,
    refetchInterval: 10_000,
  });

  const checkInMutation = useMutation({
    mutationFn: (value: string) =>
      scannerApi.checkIn(
        eventId!,
        value.trim(),
        scanSource,
        notes || undefined,
      ),
    onSuccess: (result) => {
      setLastResult(result);
      setNotes("");
      setScanValue("");
      qc.invalidateQueries({ queryKey: ["scan-stats", eventId] });
      qc.invalidateQueries({ queryKey: ["event-summary", eventId] });
      toast.success(`${result.guest_name} checked in successfully`);
      if (searchParams.get("code")) setSearchParams({});
    },
    // CHANGE: Replaced 'any' with 'unknown'
    onError: (error: unknown) => {
      const msg =
        error instanceof Error
          ? error.message
          : "Unable to check in this guest";
      toast.error(msg);
    },
  });

  // CHANGE: Fixed infinite loop by removing checkInMutation from dependency array and using local state
  useEffect(() => {
    if (!initialCode || !eventId || submittedCode === initialCode) return;
    setSubmittedCode(initialCode);
    checkInMutation.mutate(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, eventId, submittedCode]);

  const timeline = scanStats?.timeline ?? [];
  const busiestHour = useMemo(() => {
    if (!timeline.length) return null;
    return [...timeline].sort((a, b) => b.count - a.count)[0];
  }, [timeline]);

  const submitCheckIn = () => {
    if (!scanValue.trim()) {
      toast.error("Scan or paste a QR code/link first");
      return;
    }
    checkInMutation.mutate(scanValue);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-6 text-white shadow-2xl shadow-navy-900/20 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/15"
          >
            <ArrowLeft className="h-4 w-4" /> Back to event
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">
              Fast check-in desk
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {eventSummary?.event.title ?? "Guest scanner"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
              Scan a guest QR code or paste the invitation link. RoyalEntry will
              verify the pass and mark the guest as arrived instantly.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
          {[
            {
              label: "Checked in",
              value: scanStats?.arrived ?? 0,
              tone: "from-emerald-400/30 to-emerald-500/10",
            },
            {
              label: "Still waiting",
              value: scanStats?.pending ?? 0,
              tone: "from-white/15 to-white/5",
            },
            {
              label: "Arrival rate",
              value: `${scanStats?.arrival_rate_percent ?? 0}%`,
              tone: "from-gold-400/30 to-gold-500/10",
            },
            {
              label: "Busiest hour",
              value: busiestHour ? `${busiestHour.hour}` : "—",
              tone: "from-sky-400/30 to-sky-500/10",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-2xl border border-white/10 bg-gradient-to-br p-4 backdrop-blur-sm",
                item.tone,
              )}
            >
              <p className="text-xs font-medium text-slate-300">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card
          title="Scan guest pass"
          className="overflow-hidden border-0 bg-white/95 shadow-xl shadow-slate-200/70"
          action={
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4" /> Staff only
            </div>
          }
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-gold-400">
                  <ScanLine className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Ready to scan
                  </h2>
                  <p className="text-sm text-slate-600">
                    Use the phone camera scanner app, then paste the full
                    invitation link or code here.
                  </p>
                </div>
              </div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Invitation QR link or code
              </label>
              <textarea
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                rows={4}
                placeholder="Example: http://localhost:5173/events/.../scanner?code=inv-123"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 shadow-inner outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Scan source
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "QR scan", value: "qr" },
                      { label: "Manual", value: "manual" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setScanSource(option.value)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                          scanSource === option.value
                            ? "border-navy-900 bg-navy-900 text-white shadow-lg shadow-navy-900/10"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Desk notes (optional)
                  </label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. VIP entrance"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                className="w-full"
                isLoading={checkInMutation.isPending}
                onClick={submitCheckIn}
              >
                <QrCode className="h-5 w-5" /> Check in guest
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setScanValue("");
                  setNotes("");
                  setSearchParams({});
                }}
              >
                Clear form
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card
            title="Latest result"
            className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
          >
            {lastResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="h-8 w-8 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Guest checked in</p>
                    <p className="text-lg font-bold">{lastResult.guest_name}</p>
                  </div>
                </div>
                <dl className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-4">
                    <dt>Phone</dt>
                    <dd className="font-semibold text-slate-900">
                      {lastResult.guest_phone}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>Status</dt>
                    <dd>
                      <Badge label={lastResult.status} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>Time</dt>
                    <dd className="font-semibold text-slate-900">
                      {formatDateTime(lastResult.scanned_at)}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <UserRound className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No guest scanned yet
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  The last successful check-in will appear here for quick
                  confirmation.
                </p>
              </div>
            )}
          </Card>
          <Card
            title="Arrival timeline"
            className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
          >
            {timeline.length ? (
              <div className="space-y-3">
                {timeline.map((point) => {
                  const maxCount = Math.max(
                    ...timeline.map((item) => item.count),
                    1,
                  );
                  const width = `${Math.max(10, (point.count / maxCount) * 100)}%`;
                  return (
                    <div key={point.hour} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">
                          {point.hour}
                        </span>
                        <span className="text-slate-600">
                          {point.count} guests
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-emerald-400"
                          style={{ width }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <XCircle className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No arrivals yet
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Start checking in guests to build a live arrival timeline.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
