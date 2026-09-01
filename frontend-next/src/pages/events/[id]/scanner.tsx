"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  ArrowLeft, ScanLine, UserCheck, Clock, QrCode, MessageSquare,
  MessageCircle, CheckCircle2, XCircle, ShieldCheck, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input, StatCard, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import jsQR from "jsqr";

type ScanMode = "qr" | "sms";

export default function ScannerPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const qc = useQueryClient();

  const [mode, setMode] = useState<ScanMode>("qr");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [scanInterval, setScanInterval] = useState<NodeJS.Timeout | null>(null);

  // QR mode state
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ status: "ok" | "fail" | null; message: string }>({ status: null, message: "" });

  // SMS OTP mode state
  const [link, setLink] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState<string | null>(null);
  const [smsResult, setSmsResult] = useState<{ status: "ok" | "fail" | null; message: string }>({ status: null, message: "" });

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
  }, [videoStream]);

  const { data: stats } = useQuery({
    queryKey: ["scan-stats", id],
    queryFn: async () => (await api.get(`/events/${id}/scan-stats`)).data.data,
    refetchInterval: 10_000,
  });

  /* ── QR check-in ─────────────────────────────────────────────────────── */
  const checkInMutation = useMutation({
    mutationFn: (payload: { short_link: string; scan_source: string }) =>
      api.post(`/events/${id}/scan`, {
        short_link: payload.short_link,
        scan_source: payload.scan_source,
      }),
    onSuccess: (r: any) => {
      const guest = r.data.data?.guest_name ?? "guest";
      const category = r.data.data?.guest_category;
      const table = r.data.data?.table_number;
      const seat = table ? ` · Table ${table}` : "";
      const cls = category ? ` · ${category}` : "";
      setResult({ status: "ok", message: `Welcome, ${guest}! Checked in successfully.${cls}${seat}` });
      toast.success(`Welcome, ${guest}!`);
      setCode("");
      qc.invalidateQueries({ queryKey: ["scan-stats", id] });
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const msg =
        status === 409 ? "QR code already used or guest already checked in." :
        status === 404 ? "Invalid QR code. Guest not found." :
        e?.response?.data?.error?.message ?? "Check-in failed.";
      setResult({ status: "fail", message: msg });
      toast.error(msg);
    },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setVideoStream(stream);
      const video = document.querySelector("video") as HTMLVideoElement;
      if (video) {
        video.srcObject = stream;
        video.play();
      }
    } catch (e) {
      toast.error("Camera access denied or not available");
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
    if (!code.trim()) { toast.error("Please scan or enter a QR code"); return; }
    checkInMutation.mutate({ short_link: code.trim(), scan_source: "qr" });
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
      }),
    onSuccess: (r: any) => {
      const guest = r.data.data?.guest_name ?? "guest";
      setSmsResult({ status: "ok", message: `Identity verified. Welcome, ${guest}!` });
      toast.success(`Verified & checked in: ${guest}`);
      setOtp("");
      setOtpSent(null);
      setLink("");
      qc.invalidateQueries({ queryKey: ["scan-stats", id] });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.status === 409 ? "This invitation was already used." :
        e?.response?.data?.error?.message ?? "Invalid or expired OTP";
      setSmsResult({ status: "fail", message: msg });
      toast.error(msg);
    },
  });

  const handleSendOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSmsResult({ status: null, message: "" });
    if (!link.trim()) { toast.error("Please enter the invitation link"); return; }
    sendOtpMutation.mutate({ short_link: link.trim() });
  };

  const handleVerifyOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!otp.trim()) { toast.error("Please enter the OTP"); return; }
    verifyOtpMutation.mutate({ short_link: otpSent!, code: otp.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Guest Scanner</h1>
          <p className="text-sm text-slate-500">Check-in guests via QR or SMS-link identity verification</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard title="Total Guests" value={stats?.total_guests ?? 0} icon={ScanLine} color="blue" />
        <StatCard title="Arrived" value={stats?.arrived ?? 0} icon={UserCheck} color="green" subtitle={`${stats?.arrival_rate_percent ?? 0}% attendance`} />
        <StatCard title="Pending" value={stats?.pending ?? 0} icon={Clock} color="gold" />
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <button
          onClick={() => { setMode("qr"); setResult({ status: null, message: "" }); }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
            mode === "qr" ? "bg-navy-950 text-white" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <QrCode className="h-4 w-4" /> QR Code Scan
        </button>
        <button
          onClick={() => { setMode("sms"); setSmsResult({ status: null, message: "" }); }}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
            mode === "sms" ? "bg-navy-950 text-white" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <MessageSquare className="h-4 w-4" /> SMS Link Verification
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── QR mode ──────────────────────────────────────────────────── */}
        {mode === "qr" && (
          <Card title="QR Code Check-in">
            <form onSubmit={handleQrCheckIn} className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm text-blue-800">
                <QrCode className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Scan the guest's QR code</p>
                  <p className="mt-0.5 text-xs">
                    Use the camera below for live scanning, or paste the QR code / short link manually. Accepted codes check the guest in; already-used or invalid codes are declined.
                  </p>
                </div>
              </div>

              <video
                ref={videoElRef}
                className="w-full rounded-lg border border-slate-200 bg-black"
                style={{ maxHeight: 320 }}
                muted
                playsInline
                autoPlay
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { videoStream ? stopCamera() : startCamera(); }}>
                  {videoStream ? <ScanLine className="h-4 w-4" /> : <QrCode className="h-4 w-4" />} {videoStream ? "Stop Camera" : "Start Camera"}
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Enter QR code or short link"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 font-mono"
                />
                <Button type="submit" isLoading={checkInMutation.isPending}>
                  {checkInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Check in
                </Button>
              </div>

              {result.status && (
                <div className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-sm",
                  result.status === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
                )}>
                  {result.status === "ok"
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    : <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  {result.message}
                </div>
              )}
            </form>
          </Card>
        )}

        {/* ── SMS link OTP mode ────────────────────────────────────────── */}
        {mode === "sms" && (
          <Card title="SMS Link Verification (OTP)">
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-violet-100 bg-violet-50/60 p-3 text-sm text-violet-800">
                <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-semibold">For guests invited via SMS</p>
                  <p className="mt-0.5 text-xs">
                    Enter the invitation link from the guest's SMS. We'll send a one-time OTP to their phone. Enter the OTP to verify and check them in.
                  </p>
                </div>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3">
                  <Input
                    placeholder="Paste the invitation link from SMS"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="font-mono"
                  />
                  <Button type="submit" isLoading={sendOtpMutation.isPending} className="w-full">
                    {sendOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Send OTP to Guest
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div className="rounded-lg bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">OTP sent to guest. Enter the code they received:</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">Link: {otpSent}</p>
                  </div>
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="text-center font-mono text-lg tracking-widest"
                    maxLength={6}
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setOtpSent(null); setSmsResult({ status: null, message: "" }); }} className="flex-1">
                      Change link
                    </Button>
                    <Button type="submit" isLoading={verifyOtpMutation.isPending} className="flex-1">
                      {verifyOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Verify & Check in
                    </Button>
                  </div>
                </form>
              )}

              {smsResult.status && (
                <div className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-sm",
                  smsResult.status === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
                )}>
                  {smsResult.status === "ok"
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    : <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  {smsResult.message}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Arrival progress */}
        <Card title="Arrival Progress">
          {stats && stats.total_guests > 0 ? (
            <div>
              <div className="mb-2 flex justify-between text-sm text-slate-500">
                <span>{stats.arrival_rate_percent}% arrived</span>
                <span>{stats.arrived} / {stats.total_guests}</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-700"
                  style={{ width: `${stats.arrival_rate_percent}%` }} />
              </div>
              {stats.timeline?.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {stats.timeline.slice(-6).map((t: any) => (
                    <div key={t.hour} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{t.hour}</span>
                      <div className="h-1.5 flex-1 mx-3 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-gold-400" style={{ width: `${Math.min(100, (t.count / Math.max(stats.arrived, 1)) * 100)}%` }} />
                      </div>
                      <span className="font-semibold text-slate-700">{t.count}</span>
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
  );
}