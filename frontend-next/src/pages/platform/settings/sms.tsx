"use client";

import { MessageSquare, Save } from "lucide-react";
import { useState } from "react";
import { Card, Button, Input } from "@/components/ui";

export default function SMSConfigPage() {
  const [provider, setProvider] = useState("africas_talking");
  const [apiKey, setApiKey] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SMS Config</h1>
        <p className="text-sm text-slate-500">Configure SMS gateway for broadcast and reminders</p>
      </div>
      <Card title="SMS Gateway">
        <div className="space-y-4">
          <Input label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="africas_talking" />
          <Input label="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter SMS API key" />
          <div className="flex justify-end">
            <Button><Save className="h-4 w-4" /> Save</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
