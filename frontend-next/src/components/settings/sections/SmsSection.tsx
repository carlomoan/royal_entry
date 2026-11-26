"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";

const SANDBOX_WARNING =
  "Sandbox records messages instead of delivering them. Never enable in production — the backend forces it off when ENVIRONMENT=production.";

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

export default function SmsSection() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });
  const [provider, setProvider] = useState("");
  const [nextsmsToken, setNextsmsToken] = useState("");
  const [nextsmsSenderId, setNextsmsSenderId] = useState("");
  const [nextsmsBaseUrl, setNextsmsBaseUrl] = useState("");
  const [unitxtToken, setUnitxtToken] = useState("");
  const [unitxtSenderId, setUnitxtSenderId] = useState("");
  const [unitxtBaseUrl, setUnitxtBaseUrl] = useState("");
  const [providerOrder, setProviderOrder] = useState("");
  const [failover, setFailover] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("RoyalEntry SMS test");
  const [testResult, setTestResult] = useState<ChannelTestResult | null>(null);

  useEffect(() => {
    setProvider(asText(settings?.sms_provider));
    // Secrets come back masked — treat as write-only (blank keeps the saved value).
    setNextsmsToken(asText(settings?.nextsms_api_token));
    setNextsmsSenderId(asText(settings?.nextsms_sender_id));
    setNextsmsBaseUrl(asText(settings?.nextsms_base_url));
    setUnitxtToken(asText(settings?.unitxt_api_token));
    setUnitxtSenderId(asText(settings?.unitxt_sender_id));
    setUnitxtBaseUrl(asText(settings?.unitxt_base_url));
    setProviderOrder(asText(settings?.sms_provider_order));
    setFailover(asBool(settings?.sms_failover));
    setSandbox(asBool(settings?.enable_sms_sandbox));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("SMS config saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/settings/channels/test", {
        channel: "sms",
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SMS Config</h1>
        <p className="text-sm text-slate-500">Configure SMS gateways for broadcast and reminders</p>
      </div>
      <Card title="SMS Gateway">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Select label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">Auto</option>
                <option value="nextsms">NextSMS</option>
                <option value="unitxt">Unitxt</option>
              </Select>
              <p className="text-xs text-slate-500">Beem is no longer supported.</p>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800">NextSMS</h4>
              <Input
                label="API Token"
                type="password"
                value={nextsmsToken}
                onChange={(e) => setNextsmsToken(e.target.value)}
                placeholder={nextsmsToken ? "Enter NextSMS API token" : "Saved — leave blank to keep"}
              />
              <Input label="Sender ID" value={nextsmsSenderId} onChange={(e) => setNextsmsSenderId(e.target.value)} placeholder="RoyalEntry" />
              <Input label="Base URL" value={nextsmsBaseUrl} onChange={(e) => setNextsmsBaseUrl(e.target.value)} placeholder="https://nextsms.co.tz" />
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-800">Unitxt</h4>
              <Input
                label="API Token"
                type="password"
                value={unitxtToken}
                onChange={(e) => setUnitxtToken(e.target.value)}
                placeholder={unitxtToken ? "Enter Unitxt API token" : "Saved — leave blank to keep"}
              />
              <Input label="Sender ID" value={unitxtSenderId} onChange={(e) => setUnitxtSenderId(e.target.value)} placeholder="RoyalEntry" />
              <Input label="Base URL" value={unitxtBaseUrl} onChange={(e) => setUnitxtBaseUrl(e.target.value)} placeholder="https://unitxt.co.tz/api/v3" />
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-4">
              <Input
                label="Provider Order"
                value={providerOrder}
                onChange={(e) => setProviderOrder(e.target.value)}
                placeholder="nextsms,unitxt"
                hint="Comma separated; used when Provider is Auto or failover is enabled."
              />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={failover} onChange={(e) => setFailover(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
                Enable failover to the next provider
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} className="h-4 w-4 rounded accent-gold-500" />
                  Enable SMS sandbox
                </label>
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{SANDBOX_WARNING}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => {
                const payload: Record<string, unknown> = {
                  sms_provider: provider,
                  nextsms_sender_id: nextsmsSenderId,
                  nextsms_base_url: nextsmsBaseUrl,
                  unitxt_sender_id: unitxtSenderId,
                  unitxt_base_url: unitxtBaseUrl,
                  sms_provider_order: providerOrder,
                  sms_failover: failover,
                  enable_sms_sandbox: sandbox,
                };
                if (nextsmsToken.trim()) payload.nextsms_api_token = nextsmsToken;
                if (unitxtToken.trim()) payload.unitxt_api_token = unitxtToken;
                saveMutation.mutate(payload);
              }} isLoading={saveMutation.isPending}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        )}
      </Card>

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
          <div>
            <Button
              onClick={() => testMutation.mutate()}
              isLoading={testMutation.isPending}
              disabled={!testTo.trim() || !testMessage.trim()}
            >
              <MessageSquare className="h-4 w-4" /> Send
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
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
