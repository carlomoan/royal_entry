"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";

export default function SMSConfigPage() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });
  const [provider, setProvider] = useState("africas_talking");
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [fromName, setFromName] = useState("RoyalEntry");

  useEffect(() => {
    if (settings?.sms_provider) setProvider(settings.sms_provider);
    if (settings?.sms_api_key) setApiKey(settings.sms_api_key);
    if (settings?.sms_username) setUsername(settings.sms_username);
    if (settings?.sms_from_name) setFromName(settings.sms_from_name);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("SMS config saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SMS Config</h1>
        <p className="text-sm text-slate-500">Configure SMS gateway for broadcast and reminders</p>
      </div>
      <Card title="SMS Gateway">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-4">
            <Input label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="africas_talking" />
            <Input label="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter SMS API key" />
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Sandbox username" />
            <Input label="Sender / From Name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="RoyalEntry" />
            <div className="flex justify-end">
              <Button onClick={() => saveMutation.mutate({ sms_provider: provider, sms_api_key: apiKey, sms_username: username, sms_from_name: fromName })} isLoading={saveMutation.isPending}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
