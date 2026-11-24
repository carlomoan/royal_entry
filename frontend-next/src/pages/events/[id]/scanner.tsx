"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft, ScanLine, UserCheck, Clock, QrCode, MessageSquare,
  MessageCircle, CheckCircle2, XCircle, ShieldCheck, Loader2, Zap,
  AlertTriangle, ShieldAlert, MapPin,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { isOnline } from "@/lib/offline";
import {
  saveEventData, findGuestByLink, getOfflineArrivals, markOfflineArrival, isAlreadyArrivedOffline,
} from "@/lib/scannerOffline";
import { Card, Button, Input, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import jsQR from "jsqr";

type ScanMode = "qr" | "sms";

type ScanResult = {
  status: "ok" | "fail" | "warn" | null;
  message: string;
  company?: string;
  packageName?: string;
  entry?: string;
};

type ScanPayload = { short_link: string; scan_source: string; gate: string };

export default function ScannerPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const qc = useQueryClient();

  const [mode, setMode] = useState<ScanMode>("qr");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  // Tracks the last submitted QR/manual link so onError can prefill the OTP form.
  const lastLinkRef = useRef<string>("");
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);

  // Gate label is attached to every scan so duplicate messages name the entry point.
  const [gate, setGate] = useState<string>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("royalentry_gate_label") || "Gate 1"
      : "Gate 1"
  );
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("royalentry_gate_label", gate);
    }
  }, [gate]);
  // Delayed camera auto-submits use a ref so they always send the latest label.
  const gateRef = useRef(gate);
  useEffect(() => { gateRef.current = gate; }, [gate]);

  // QR mode state
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult>({ status: null, message: "" });

  // SMS OTP mode state
  const [link, setLink] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState<string | null>(null);
  const [smsResult, setSmsResult] = useState<{ status: "ok" | "fail" | "warn" | null; message: string }>({ status: null, message: "" });

  // Manual override (exceptional, logged) state
  const [showOverride, setShowOverride] = useState(false);
  const [overrideLink, setOverrideLink] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // Inline name capture after the corporate name-registration cutoff
  const [captureLink, setCaptureLink] = useState<string | null>(null);
  const [captureName, setCaptureName] = useState("");
  const [capturePhone, setCapturePhone] = useState("");

  // Live QR scanning from camera stream using jsQR
  useEffect(() => {
    if (!videoStream) return;
    const interval = setInterval(() => {
      const video = videoElRef.current;
      if (!video || video.readyState < 2) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const codeData = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (codeData && codeData.data && codeData.data !== code) {
          setCode(codeData.data);
          // Auto-submit after a short delay to avoid rapid re-submissions
          setTimeout(() => {
            if (codeData.data === code) {
              const evt = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
              handleQrCheckIn(evt);
            }
          }, 500);
        }
      } catch {
        // No QR found — ignore silently
      }
    }, 300);
    setScanInterval(interval);
    return () => { clearInterval(interval); setScanInterval(null); };
  }, [videoStream, code]);

  const { data: stats } = useQuery({
    queryKey: ["scan-stats", id],
    queryFn: async () => (await api.get(`/events/${id}/scan-stats`)).data.data,
    refetchInterval: 10_000,
  });

  // Cache the event's guests + invitations locally so scanning works offline.
  const { data: guests = [] } = useQuery({
    queryKey: ["guests", id],
    queryFn: async () => (await api.get(`/events/${id}/guests?per_page=500`)).data.data ?? [],
    enabled: !!id,
  });
  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", id],
    queryFn: async () => (await api.get(`/events/${id}/invitations?per_page=500`)).data.data ?? [],
    enabled: !!id,
  });
  useEffect(() => {
    if (id && guests.length > 0 && invitations.length > 0) {
      saveEventData(id, guests, invitations);
    }
  }, [id, guests, invitations]);

  const offlineArrivals = id ? getOfflineArrivals(id) : [];
  const offline = !isOnline();

  /* ── QR check-in ─────────────────────────────────────────────────────── */
  const checkInMutation = useMutation({
    mutationFn: (payload: ScanPayload) =>
      api.post(`/events/${id}/scan`, {
        short_link: payload.short_link,
        scan_source: payload.scan_source,
        gate: payload.gate,
      }),
    onSuccess: (r: any) => {
      const d = r.data?.data ?? {};
      // Offline queued check-in: resolve the guest name from the local cache.
      const guest =
        r.data?.queued_offline
          ? (findGuestByLink(id, code)?.full_name ?? "guest")
          : (d.guest_name ?? "guest");
      const category = d.guest_category;
      const location = [
        d.table_number ? `Table ${d.table_number}` : null,
        d.seat_number ? `Seat ${d.seat_number}` : null,
      ].filter(Boolean).join(", ");
      const locPart = location ? ` · ${location}` : "";
      const cls = category ? ` · ${category}` : "";
      const entryText =
        d.entries_used != null && d.party_size != null
          ? `Entry ${d.entries_used} of ${d.party_size} on this card`
          : "";
      const entryPart = entryText ? ` · ${entryText}` : "";
      const affiliation = [d.company_name, d.package_name].filter(Boolean).join(" · ");
      const affiliationPart = affiliation ? ` · ${affiliation}` : "";
      const suffix = r.data?.queued_offline ? " (offline — will sync)" : "";
      setResult({
        status: "ok",
        message: `Welcome, ${guest}! Checked in successfully.${cls}${locPart}${entryPart}${affiliationPart}${suffix}`,
        company: d.company_name ?? undefined,
        packageName: d.package_name ?? undefined,
        entry: entryText || undefined,
      });
      toast.success(`Welcome, ${guest}!${suffix}`);
      setCode("");
      setCaptureLink(null);

      // ✅ Haptic feedback for mobile success
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      qc.invalidateQueries({ queryKey: ["scan-stats", id] });
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const errorCode = e?.response?.data?.error?.code;
      const backendMsg: string =
        e?.response?.data?.error?.message ?? "Check-in failed.";

      if (status === 428 || errorCode === "OTP_REQUIRED") {
        // Backend requires identity confirmation — hand off to the OTP flow.
        const msg = "Identity confirmation required — send a one-time code to this guest.";
        setMode("sms");
        setLink(lastLinkRef.current);
        setOtpSent(null);
        setOtp("");
        setResult({ status: null, message: "" });
        setSmsResult({ status: "warn", message: msg });
        toast.error(msg);
        return;
      }

      // Corporate name cutoff: capture the identity at the gate, then retry.
      if (backendMsg.includes("Name registration deadline passed")) {
        setCaptureLink(lastLinkRef.current);
        setCaptureName("");
        setCapturePhone("");
        setResult({ status: "warn", message: backendMsg });
        toast.error(backendMsg);
        if (navigator.vibrate) navigator.vibrate(300);
        return;
      }

      // Duplicate scan — the backend message includes the time and gate of first use.
      if (errorCode === "ALREADY_USED" || status === 409) {
        const msg = errorCode === "ALREADY_USED"
          ? backendMsg
          : "QR code already used or guest already checked in.";
        setResult({ status: "warn", message: msg });
        toast.error(msg);
        if (navigator.vibrate) navigator.vibrate(300);
        return;
      }

      // Revoked corporate pass — must never be admitted at the gate.
      if (status === 400 && /revoked/i.test(backendMsg)) {
        setResult({ status: "fail", message: backendMsg });
        toast.error(backendMsg);
        if (navigator.vibrate) navigator.vibrate(300);
        return;
      }

      const msg = status === 404 ? "Invalid QR code. Guest not found." : backendMsg;
      setResult({ status: "fail", message: msg });
      toast.error(msg);

      // ✅ Haptic feedback for mobile error
      if (navigator.vibrate) navigator.vibrate(300);
    },
  });

  /* ── Inline name capture (after the name-registration cutoff) ─────────── */
  const captureNameMutation = useMutation({
    mutationFn: (payload: { short_link: string; full_name: string; phone: string }) =>
      api.post(`/events/${id}/scan/capture-name`, {
        short_link: payload.short_link,
        full_name: payload.full_name,
        phone: payload.phone,
      }),
    onSuccess: (_r, variables) => {
      toast.success("Name captured — entry logged for review");
      setCaptureLink(null);
      setCaptureName("");
      setCapturePhone("");
      setResult({ status: null, message: "" });
      // The pass now has a name — retry the original QR scan exactly once.
      checkInMutation.mutate({
        short_link: variables.short_link,
        scan_source: "qr",
        gate: gateRef.current,
      });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? "Could not capture name.";
      setResult({ status: "fail", message: msg });
      toast.error(msg);
    },
  });

  const handleCaptureName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!captureLink) return;
    if (!captureName.trim()) { toast.error("Please enter the attendee's full name"); return; }
    captureNameMutation.mutate({
      short_link: captureLink,
      full_name: captureName.trim(),
      phone: capturePhone.trim(),
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setVideoStream(stream);
      const video = videoElRef.current;
      if (video) {
        video.srcObject = stream;
        video.play();
      }
    } catch (e) {
      toast.error("Camera access denied. Use manual entry below.");
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
      setVideoStream(null);
    }
    if (scanInterval) {
      clearInterval(scanInterval);
      setScanInterval(null);
    }
  };

  const handleQrCheckIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult({ status: null, message: "" });
    const link = code.trim();
    if (!link) { toast.error("Please scan or enter a QR code"); return; }
    lastLinkRef.current = link;

    // Offline check-in: resolve from the local cache, record locally, and queue.
    // The mutation's onSuccess shows the welcome + queues for sync.
    if (offline) {
      const guest = findGuestByLink(id, link);
      if (!guest) {
        setResult({ status: "fail", message: "Offline: guest not found in the cached list. Go online to scan new guests." });
        toast.error("Guest not found in offline cache");
        if (navigator.vibrate) navigator.vibrate(300);
        return;
      }
      if (isAlreadyArrivedOffline(id, link)) {
        setResult({ status: "fail", message: "Already checked in (offline)." });
        toast.error("Already checked in");
        return;
      }
      markOfflineArrival(id, link, guest.full_name);
      checkInMutation.mutate({ short_link: link, scan_source: "qr_offline", gate: gateRef.current });
      return;
    }

    checkInMutation.mutate({ short_link: link, scan_source: "qr", gate: gateRef.current });
  };

  /* ── SMS link OTP flow ───────────────────────────────────────────────── */
  const sendOtpMutation = useMutation({
    mutationFn: (payload: { short_link: string }) =>
      api.post(`/events/${id}/scan/otp/send`, { short_link: payload.short_link }),
    onSuccess: () => {
      setOtpSent(link.trim());
      setSmsResult({ status: null, message: "OTP sent to guest phone. Ask them for the code." });
      toast.success("OTP sent to guest phone");
    },
    onError: (e: any) => {
      const msg =
        e?.response?.status === 404 ? "Invalid invitation link. Guest not found." :
        e?.response?.data?.error?.message ?? "Failed to send OTP";
      setSmsResult({ status: "fail", message: msg });
      toast.error(msg);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (payload: { short_link: string; code: string }) =>
      api.post(`/events/${id}/scan/otp/verify`, {
        short_link: payload.short_link,
        code: payload.code,
        gate: gateRef.current,
      }),
    onSuccess: (r: any) => {
      const guest = r.data.data?.guest_name ?? "guest";
      setSmsResult({ status: "ok", message: `Identity verified. Welcome, ${guest}!` });
      toast.success(`Verified & checked in: ${guest}`);
      setOtp("");
      setOtpSent(null);
      setLink("");

      // ✅ Haptic feedback
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

      qc.invalidateQueries({ queryKey: ["scan-stats", id] });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.status === 409 ? "This invitation was already used." :
        e?.response?.data?.error?.message ?? "Invalid or expired OTP";
      setSmsResult({ status: "fail", message: msg });
      toast.error(msg);

      if (navigator.vibrate) navigator.vibrate(300);
    },
  });

  const handleSendOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSmsResult({ status: null, message: "" });
    if (offline) {
      setSmsResult({ status: "fail", message: "OTP verification requires an internet connection." });
      toast.error("OTP requires online");
      return;
    }
    if (!link.trim()) { toast.error("Please enter the invitation link"); return; }
    sendOtpMutation.mutate({ short_link: link.trim() });
  };

  const handleVerifyOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (offline) {
      setSmsResult({ status: "fail", message: "OTP verification requires an internet connection." });
      toast.error("OTP requires online");
      return;
    }
    if (!otp.trim()) { toast.error("Please enter the OTP"); return; }
    verifyOtpMutation.mutate({ short_link: otpSent!, code: otp.trim() });
  };

  /* ── Manual override (logged, exceptional) ───────────────────────────── */
  const overrideMutation = useMutation({
    mutationFn: (payload: { short_link?: string; reason: string }) =>
      api.post(`/events/${id}/scan/override`, {
        short_link: payload.short_link,
        reason: payload.reason,
      }),
    onSuccess: (r: any) => {
      const guest = r.data?.data?.guest_name ?? "guest";
      setSmsResult({
        status: "warn",
        message: `Manual override applied for ${guest}. This override was logged.`,
      });
      toast.success(`Manual override applied for ${guest}`);
      setShowOverride(false);
      setOverrideReason("");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      qc.invalidateQueries({ queryKey: ["scan-stats", id] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? "Manual override failed.";
      setSmsResult({ status: "fail", message: msg });
      toast.error(msg);
      if (navigator.vibrate) navigator.vibrate(300);
    },
  });

  const handleOverride = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSmsResult({ status: null, message: "" });
    if (offline) {
      setSmsResult({ status: "fail", message: "Manual override requires an internet connection." });
      toast.error("Manual override requires online");
      return;
    }
    if (!overrideReason.trim()) { toast.error("Please provide a reason for the override"); return; }
    overrideMutation.mutate({
      short_link: overrideLink.trim() || undefined,
      reason: overrideReason.trim(),
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      {/* Sticky Header - Always accessible on mobile */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6">
        <button onClick={() => router.back()} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-slate-900">Guest Scanner</h1>
          <p className="truncate text-xs text-slate-500">QR or SMS-link verification</p>
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-6">
        {/* Gate label — recorded on every check-in */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <MapPin className="h-4 w-4 flex-shrink-0 text-gold-600" />
          <label htmlFor="gate-label" className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Gate
          </label>
          <Input
            id="gate-label"
            value={gate}
            onChange={(e) => setGate(e.target.value)}
            placeholder="Gate 1"
            className="w-32 py-1.5 text-sm font-semibold"
          />
          <span className="text-xs text-slate-400">Recorded on every check-in</span>
        </div>

        {/* Offline indicator */}
        {offline && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>
                Offline mode — scanning from the cached guest list.
                {offlineArrivals.length > 0 && ` ${offlineArrivals.length} offline check-in(s) will sync when back online.`}
              </span>
            </div>
            {offlineArrivals.length > 0 && (
              <button
                onClick={() => toast(`Offline check-ins:\n${offlineArrivals.map((a) => a.guest_name).join("\n")}`)}
                className="rounded-md bg-white/70 px-2 py-1 text-xs font-semibold hover:bg-white"
              >
                View ({offlineArrivals.length})
              </button>
            )}
          </div>
        )}

        {/* Stats - Compact for mobile, easy to read at a glance */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
            <p className="text-xl font-black text-slate-900">{stats?.total_guests ?? 0}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Arrived</p>
            <p className="text-xl font-black text-emerald-700">{stats?.arrived ?? 0}</p>
          </div>
          <div className="rounded-lg bg-gold-50 p-3 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gold-600">Pending</p>
            <p className="text-xl font-black text-gold-700">{stats?.pending ?? 0}</p>
          </div>
        </div>

        {/* Mode selector - Large touch targets */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            onClick={() => { setMode("qr"); setResult({ status: null, message: "" }); }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition",
              mode === "qr" ? "bg-navy-950 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <QrCode className="h-5 w-5" /> QR Scan
          </button>
          <button
            onClick={() => { setMode("sms"); setSmsResult({ status: null, message: "" }); }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition",
              mode === "sms" ? "bg-navy-950 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <MessageSquare className="h-5 w-5" /> SMS OTP
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── QR mode ──────────────────────────────────────────────────── */}
          {mode === "qr" && (
            <Card title="QR Code Check-in" className="shadow-sm">
              <form onSubmit={handleQrCheckIn} className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-800">
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Point camera at guest's QR code</p>
                    <p className="mt-0.5 text-xs">Or paste the short link manually below.</p>
                  </div>
                </div>

                {/* Camera Viewfinder */}
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black">
                  <video
                    ref={videoElRef}
                    className="w-full object-cover"
                    style={{ maxHeight: 400, minHeight: 250 }}
                    muted
                    playsInline
                    autoPlay
                  />
                  {!videoStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                      <QrCode className="h-12 w-12 text-white/50" />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={videoStream ? "danger" : "outline"}
                    className="flex-1 py-3 text-base font-semibold"
                    onClick={() => { videoStream ? stopCamera() : startCamera(); }}
                  >
                    {videoStream ? <ScanLine className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                    {videoStream ? "Stop Camera" : "Start Camera"}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Or paste QR code / link here"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="flex-1 font-mono text-base"
                  />
                  <Button type="submit" isLoading={checkInMutation.isPending} className="px-4 py-3 text-base font-bold">
                    {checkInMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    Check In
                  </Button>
                </div>

              </form>

              {result.status && (
                <div className={cn(
                  "mt-4 flex items-start gap-3 rounded-xl border p-4 text-base font-semibold shadow-sm",
                  result.status === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : result.status === "warn" ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                )}>
                  {result.status === "ok"
                    ? <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0" />
                    : result.status === "warn"
                    ? <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0" />
                    : <XCircle className="mt-0.5 h-6 w-6 flex-shrink-0" />}
                  <div className="min-w-0 break-words">
                    <p className="leading-tight">{result.message}</p>
                    {result.status === "ok" && (result.company || result.packageName || result.entry) && (
                      <div className="mt-2 space-y-1 border-t border-emerald-200 pt-2 text-sm font-medium">
                        {result.company && <p>Company: {result.company}</p>}
                        {result.packageName && <p>Package: {result.packageName}</p>}
                        {result.entry && <p>{result.entry}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {captureLink && (
                <form
                  onSubmit={handleCaptureName}
                  className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4"
                >
                  <div className="flex items-start gap-2 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p className="font-semibold">
                      Name registration deadline passed. Capture the attendee name before check-in.
                    </p>
                  </div>
                  <Input
                    label="Full name"
                    placeholder="Attendee full name"
                    value={captureName}
                    onChange={(e) => setCaptureName(e.target.value)}
                    className="bg-white"
                  />
                  <Input
                    label="Phone (optional)"
                    placeholder="Attendee phone"
                    value={capturePhone}
                    onChange={(e) => setCapturePhone(e.target.value)}
                    className="bg-white"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    isLoading={captureNameMutation.isPending}
                    className="w-full border-amber-400 py-3 text-base font-bold text-amber-800 hover:bg-amber-100"
                  >
                    Capture name and retry check-in
                  </Button>
                </form>
              )}
            </Card>
          )}

          {/* ── SMS link OTP mode ────────────────────────────────────────── */}
          {mode === "sms" && (
            <Card title="SMS Link Verification (OTP)" className="shadow-sm">
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-violet-100 bg-violet-50/60 p-3 text-sm text-violet-800">
                  <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">For guests invited via SMS</p>
                    <p className="mt-0.5 text-xs">Enter the invitation link from the guest's SMS. We'll send a one-time OTP to their phone.</p>
                  </div>
                </div>

                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <Input
                      placeholder="Paste the invitation link from SMS"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="font-mono text-base"
                    />
                    <Button type="submit" isLoading={sendOtpMutation.isPending} className="w-full py-3 text-base font-bold">
                      {sendOtpMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                      Send OTP to Guest
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <p className="text-sm font-semibold text-slate-700">OTP sent to guest</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-400">{otpSent}</p>
                    </div>
                    <Input
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="text-center font-mono text-2xl font-bold tracking-[0.5em]"
                      maxLength={6}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => { setOtpSent(null); setSmsResult({ status: null, message: "" }); }} className="flex-1 py-3">
                        Change link
                      </Button>
                      <Button type="submit" isLoading={verifyOtpMutation.isPending} className="flex-1 py-3 text-base font-bold">
                        {verifyOtpMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                        Verify & Check in
                      </Button>
                    </div>
                  </form>
                )}

                {/* Manual override — exceptional, logged action */}
                <div className="border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOverride((v) => !v);
                      setOverrideLink(otpSent ?? link);
                      setSmsResult({ status: null, message: "" });
                    }}
                    className="text-sm font-semibold text-amber-700 hover:text-amber-800 hover:underline"
                  >
                    {showOverride ? "Hide manual override" : "No code delivered? Manual override"}
                  </button>

                  {showOverride && (
                    <form onSubmit={handleOverride} className="mt-3 space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4">
                      <div className="flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>Use only when no OTP channel can reach the guest. This action is logged.</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-amber-900">Invitation link (optional)</label>
                        <Input
                          placeholder="Leave blank to use the scanned link"
                          value={overrideLink}
                          onChange={(e) => setOverrideLink(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-amber-900">Reason (required)</label>
                        <Input
                          placeholder="e.g. Guest phone unavailable"
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        isLoading={overrideMutation.isPending}
                        className="w-full border-amber-400 py-3 text-base font-bold text-amber-800 hover:bg-amber-100"
                      >
                        {overrideMutation.isPending
                          ? <Loader2 className="h-5 w-5 animate-spin" />
                          : <ShieldAlert className="h-5 w-5" />}
                        Confirm Manual Override
                      </Button>
                    </form>
                  )}
                </div>

                {smsResult.status && (
                  <div className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-base font-semibold shadow-sm",
                    smsResult.status === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : smsResult.status === "warn" ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  )}>
                    {smsResult.status === "ok"
                      ? <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0" />
                      : smsResult.status === "warn"
                      ? <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0" />
                      : <XCircle className="mt-0.5 h-6 w-6 flex-shrink-0" />}
                    <span className="leading-tight">{smsResult.message}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Arrival progress - Spans full width on larger screens */}
          <Card title="Arrival Progress" className="shadow-sm lg:col-span-2">
            {stats && stats.total_guests > 0 ? (
              <div>
                <div className="mb-2 flex justify-between text-sm text-slate-500">
                  <span className="font-semibold">{stats.arrival_rate_percent}% arrived</span>
                  <span>{stats.arrived} / {stats.total_guests}</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-700"
                    style={{ width: `${stats.arrival_rate_percent}%` }} />
                </div>
                {stats.timeline?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {stats.timeline.slice(-6).map((t: any) => (
                      <div key={t.hour} className="flex items-center justify-between text-xs">
                        <span className="w-12 text-slate-500">{t.hour}</span>
                        <div className="h-2 flex-1 mx-3 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-gold-400" style={{ width: `${Math.min(100, (t.count / Math.max(stats.arrived, 1)) * 100)}%` }} />
                        </div>
                        <span className="w-8 text-right font-semibold text-slate-700">{t.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No guest data yet</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
