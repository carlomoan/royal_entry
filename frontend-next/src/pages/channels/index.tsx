"use client";
import { MessageSquare } from "lucide-react";
import { Card, Badge } from "@/components/ui";

const CHANNELS = [
  { kind: "sms", label: "SMS", icon: MessageSquare, provider: "Africa's Talking" },
  { kind: "whatsapp", label: "WhatsApp", icon: MessageSquare, provider: "WhatsApp Business API" },
  { kind: "email", label: "Email", icon: MessageSquare, provider: "SMTP" },
  { kind: "telegram", label: "Telegram", icon: MessageSquare, provider: "Bot API" },
];

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Channels</h1>
        <p className="text-sm text-slate-500">Configure and test SMS, WhatsApp, Email and Telegram delivery channels</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map((ch) => (
          <Card key={ch.kind} title={ch.label}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Provider</span>
                <span className="text-sm font-semibold text-slate-900">{ch.provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Status</span>
                <Badge label="Configured" variant="slate" />
              </div>
              <p className="text-xs text-slate-400">Channel credentials are managed by the backend environment.</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
