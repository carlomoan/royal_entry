"use client";

import { MessageCircle, Save } from "lucide-react";
import { useState } from "react";
import { Card, Button, Input } from "@/components/ui";

export default function WhatsAppConfigPage() {
  const [phone, setPhone] = useState("");
  const [apiKey, setApiKey] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">WhatsApp Config</h1>
        <p className="text-sm text-slate-500">Configure WhatsApp Business API for messaging</p>
      </div>
      <Card title="WhatsApp Business API">
        <div className="space-y-4">
          <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255700000000" />
          <Input label="API Key / Token" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter WhatsApp API token" />
          <div className="flex justify-end">
            <Button><Save className="h-4 w-4" /> Save</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
