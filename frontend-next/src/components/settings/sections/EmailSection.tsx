"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input, Select } from "@/components/ui";

function asText(value: unknown, fallback = ""): string {
  if (value === undefined || value === null || value === "********") return fallback;
  return String(value);
}

function asBool(value: unknown, fallback = true): boolean {
  return value === true || value === "true" || (value !== false && value !== "false" && fallback);
}

export default function EmailSection() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });
  const [provider, setProvider] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailFromName, setEmailFromName] = useState("RoyalEntry");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpUseTls, setSmtpUseTls] = useState(true);

  useEffect(() => {
    setProvider(asText(settings?.email_provider));
    // Secrets come back masked — treat as write-only (blank keeps the saved value).
    setResendApiKey(asText(settings?.resend_api_key));
    setEmailFrom(asText(settings?.email_from));
    setEmailFromName(asText(settings?.email_from_name, "RoyalEntry"));
    setSmtpHost(asText(settings?.smtp_host));
    setSmtpPort(asText(settings?.smtp_port, "587"));
    setSmtpUser(asText(settings?.smtp_user));
    setSmtpPassword(asText(settings?.smtp_password));
    setSmtpUseTls(asBool(settings?.smtp_use_tls));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("Email config saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Email Config</h1>
        <p className="text-sm text-slate-500">Configure the provider used for transactional email</p>
      </div>
      <Card title="Email Delivery">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Select label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">Auto</option>
                <option value="resend">Resend</option>
                <option value="smtp">SMTP</option>
              </Select>
              <p className="text-xs text-slate-500">Resend is recommended in production. SMTP is used when email_provider=smtp.</p>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800">Resend</h4>
              <Input
                label="API Key"
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder={resendApiKey ? "Enter Resend API key" : "Saved — leave blank to keep"}
              />
              <Input label="From Address" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="noreply@royalentry.co.tz" />
              <Input label="From Name" value={emailFromName} onChange={(e) => setEmailFromName(e.target.value)} placeholder="RoyalEntry" />
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800">SMTP</h4>
              <Input label="Host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
              <Input label="Port" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
              <Input label="Username" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="SMTP username" />
              <Input
                label="Password"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={smtpPassword ? "Enter SMTP password" : "Saved — leave blank to keep"}
              />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={smtpUseTls} onChange={(e) => setSmtpUseTls(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
                Use TLS
              </label>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => {
                const payload: Record<string, unknown> = {
                  email_provider: provider,
                  email_from: emailFrom,
                  email_from_name: emailFromName,
                  smtp_host: smtpHost,
                  smtp_user: smtpUser,
                  smtp_use_tls: smtpUseTls,
                };
                const port = Number(smtpPort);
                if (Number.isInteger(port) && port > 0) payload.smtp_port = port;
                if (resendApiKey.trim()) payload.resend_api_key = resendApiKey;
                if (smtpPassword.trim()) payload.smtp_password = smtpPassword;
                saveMutation.mutate(payload);
              }} isLoading={saveMutation.isPending}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
