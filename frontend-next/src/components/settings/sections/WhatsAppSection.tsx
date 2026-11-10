"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";

export default function WhatsAppSection() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [apiVersion, setApiVersion] = useState("v21.0");

  useEffect(() => {
    // Secrets come back masked — treat as write-only (blank keeps the saved token).
    setAccessToken(settings?.whatsapp_access_token === "********" ? "" : (settings?.whatsapp_access_token ?? ""));
    if (settings?.whatsapp_phone_number_id) setPhoneNumberId(settings.whatsapp_phone_number_id);
    if (settings?.whatsapp_api_version) setApiVersion(settings.whatsapp_api_version);
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
            <Input label="Access Token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={accessToken ? "Permanent System-User token" : "Saved — leave blank to keep"} />
            <Input label="Phone Number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="e.g. 123456789012345" />
            <Input label="Graph API Version" value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} placeholder="v21.0" />
            <div className="flex justify-end">
              <Button onClick={() => {
                const payload: Record<string, unknown> = { whatsapp_phone_number_id: phoneNumberId, whatsapp_api_version: apiVersion };
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