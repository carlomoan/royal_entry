"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";

const SANDBOX_WARNING =
  "Sandbox records messages instead of delivering them. Never enable in production — the backend forces it off when ENVIRONMENT=production.";

function asText(value: unknown, fallback = ""): string {
  if (value === undefined || value === null || value === "********") return fallback;
  return String(value);
}

function asBool(value: unknown): boolean {
  return value === true || value === "true";
}

export default function WhatsAppSection() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [apiVersion, setApiVersion] = useState("v21.0");
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    // Secrets come back masked — treat as write-only (blank keeps the saved token).
    setAccessToken(asText(settings?.whatsapp_access_token));
    setPhoneNumberId(asText(settings?.whatsapp_phone_number_id));
    setApiVersion(asText(settings?.whatsapp_api_version, "v21.0"));
    setSandbox(asBool(settings?.enable_whatsapp_sandbox));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("WhatsApp config saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp Config</h1>
        <p className="text-sm text-slate-500">Configure the WhatsApp Cloud API for messaging</p>
      </div>
      <Card title="WhatsApp Cloud API">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-4">
            <Input
              label="Access Token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={accessToken ? "Permanent System-User token" : "Saved — leave blank to keep"}
            />
            <Input label="Phone Number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="e.g. 123456789012345" />
            <Input label="Graph API Version" value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} placeholder="v21.0" />
            <p className="text-xs text-slate-500">
              Free-form text only works inside Meta&apos;s 24-hour window. Use approved templates for first contact.
            </p>
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
                Enable WhatsApp sandbox
              </label>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{SANDBOX_WARNING}</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => {
                const payload: Record<string, unknown> = {
                  whatsapp_phone_number_id: phoneNumberId,
                  whatsapp_api_version: apiVersion,
                  enable_whatsapp_sandbox: sandbox,
                };
                if (accessToken.trim()) payload.whatsapp_access_token = accessToken;
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
