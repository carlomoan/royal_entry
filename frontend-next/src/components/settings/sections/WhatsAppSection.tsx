"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";

const SANDBOX_WARNING =
  "Sandbox records messages instead of delivering them. Never enable in production — the backend forces it off when ENVIRONMENT=production.";

const NEXTSMS_TEMPLATE_WARNING =
  "NextSMS v2 uses named placeholders in the approved template body, e.g. `RoyalEntry: {message}`. The placeholder names below must match the template exactly (without braces), in body order. The template must be active and approved; otherwise delivery fails after the API accepts the request. Base URL: https://messaging-service.co.tz";

type ChannelReceipt = {
  provider?: string;
  success?: boolean;
  provider_id?: string | null;
  error?: string | null;
};

type ChannelTestResult = {
  delivered: boolean;
  receipts: ChannelReceipt[];
};

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
  const [nextsmsPlaceholders, setNextsmsPlaceholders] = useState("message");
  const [sandbox, setSandbox] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("VARIABLE-TEST-123");
  const [testResult, setTestResult] = useState<ChannelTestResult | null>(null);

  useEffect(() => {
    setProvider(asText(settings?.whatsapp_provider));
    setAccessToken(asText(settings?.whatsapp_access_token));
    setPhoneNumberId(asText(settings?.whatsapp_phone_number_id));
    setApiVersion(asText(settings?.whatsapp_api_version, "v21.0"));
    setNextsmsAccount(asText(settings?.nextsms_whatsapp_account));
    setNextsmsTemplate(asText(settings?.nextsms_whatsapp_template));
    setNextsmsPlaceholders(asText(settings?.nextsms_whatsapp_placeholders, "message"));
    setSandbox(asBool(settings?.enable_whatsapp_sandbox));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("WhatsApp config saved"); },
    onError: (e: any) => toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/settings/channels/test", {
        channel: "whatsapp",
        to: testTo,
        message: testMessage,
      });
      return response.data.data as ChannelTestResult;
    },
    onSuccess: (result) => setTestResult(result),
    onError: (e: any) => {
      setTestResult(null);
      toast.error(e?.response?.data?.error?.message ?? e?.message ?? "Failed to send test message");
    },
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
        {isNextSms && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium leading-relaxed text-amber-900">
            {NEXTSMS_TEMPLATE_WARNING}
          </p>
        )}
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
            <Input label="Placeholder names" value={nextsmsPlaceholders} onChange={(e) => setNextsmsPlaceholders(e.target.value)} placeholder="message  or  name,event,date,link" />
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
            nextsms_whatsapp_placeholders: nextsmsPlaceholders,
            enable_whatsapp_sandbox: sandbox,
          };
          if (accessToken.trim()) payload.whatsapp_access_token = accessToken;
          saveMutation.mutate(payload);
        }} isLoading={saveMutation.isPending}>
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>

      <Card title="Send test message">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Sends a real message through the configured provider and returns its delivery receipt.</p>
          <Input
            label="Recipient"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="2557XXXXXXXX"
          />
          <Textarea
            label="Message"
            rows={3}
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
          />
          <p className="-mt-3 text-xs text-slate-400">
            The backend puts this text into the first placeholder name configured above.
          </p>
          <div>
            <Button
              onClick={() => testMutation.mutate()}
              isLoading={testMutation.isPending}
              disabled={!testTo.trim() || !testMessage.trim()}
            >
              <MessageCircle className="h-4 w-4" /> Send
            </Button>
          </div>
          {testResult && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Delivered:{" "}
                <span className={testResult.delivered ? "text-emerald-600" : "text-red-600"}>
                  {testResult.delivered ? "Yes" : "No"}
                </span>
              </p>
              {testResult.receipts.length === 0 ? (
                <p className="text-xs text-slate-500">No provider receipts returned.</p>
              ) : (
                <ul className="space-y-2">
                  {testResult.receipts.map((receipt, index) => (
                    <li key={index} className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <p className="break-words"><span className="font-semibold">Provider:</span> {receipt.provider ?? "—"}</p>
                      <p className="break-words"><span className="font-semibold">Success:</span> {receipt.success ? "true" : "false"}</p>
                      <p className="break-words"><span className="font-semibold">Provider ID:</span> {receipt.provider_id ?? "—"}</p>
                      <p className="break-words"><span className="font-semibold">Error:</span> {receipt.error ?? "—"}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500">
                Check the NextSMS dashboard delivery log if the receipt says success but the phone receives nothing.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
