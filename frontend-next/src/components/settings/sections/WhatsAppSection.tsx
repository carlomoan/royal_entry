"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input, Select } from "@/components/ui";

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
  const [provider, setProvider] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [apiVersion, setApiVersion] = useState("v21.0");
  const [nextsmsAccount, setNextsmsAccount] = useState("");
  const [nextsmsTemplate, setNextsmsTemplate] = useState("");
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    setProvider(asText(settings?.whatsapp_provider));
    setAccessToken(asText(settings?.whatsapp_access_token));
    setPhoneNumberId(asText(settings?.whatsapp_phone_number_id));
    setApiVersion(asText(settings?.whatsapp_api_version, "v21.0"));
    setNextsmsAccount(asText(settings?.nextsms_whatsapp_account));
    setNextsmsTemplate(asText(settings?.nextsms_whatsapp_template));
    setSandbox(asBool(settings?.enable_whatsapp_sandbox));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("WhatsApp config saved"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed"),
  });

  const isNextSms = provider === "nextsms";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp Config</h1>
        <p className="text-sm text-slate-500">Configure WhatsApp delivery — Meta Cloud API or NextSMS</p>
      </div>

      <Card title="Provider">
        <Select
          label="WhatsApp provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="">Auto (Meta Cloud when token is set)</option>
          <option value="cloud">Meta Cloud API</option>
          <option value="nextsms">NextSMS WhatsApp</option>
        </Select>
        <p className="mt-2 text-xs text-slate-500">
          NextSMS WhatsApp is template-based: the account name and an approved template must be set on your NextSMS account.
        </p>
      </Card>

      {!isNextSms && (
        <Card title="Meta Cloud API">
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
          </div>
        </Card>
      )}

      {isNextSms && (
        <Card title="NextSMS WhatsApp">
          <div className="space-y-4">
            <Input label="Account name" value={nextsmsAccount} onChange={(e) => setNextsmsAccount(e.target.value)} placeholder="Your NextSMS WhatsApp account name" />
            <Input label="Approved template" value={nextsmsTemplate} onChange={(e) => setNextsmsTemplate(e.target.value)} placeholder="Template name registered on NextSMS" />
            <p className="text-xs text-slate-500">
              Uses the NextSMS API token and base URL from SMS Config. The &quot;to&quot; field is sent as an array with account and template, as required by NextSMS.
            </p>
          </div>
        </Card>
      )}

      <Card title="Testing">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
            Enable WhatsApp sandbox
          </label>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{SANDBOX_WARNING}</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => {
          const payload: Record<string, unknown> = {
            whatsapp_provider: provider,
            whatsapp_phone_number_id: phoneNumberId,
            whatsapp_api_version: apiVersion,
            nextsms_whatsapp_account: nextsmsAccount,
            nextsms_whatsapp_template: nextsmsTemplate,
            enable_whatsapp_sandbox: sandbox,
          };
          if (accessToken.trim()) payload.whatsapp_access_token = accessToken;
          saveMutation.mutate(payload);
        }} isLoading={saveMutation.isPending}>
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>
    </div>
  );
}
