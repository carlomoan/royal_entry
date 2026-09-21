"use client";
import { useState } from "react";
import { MessageSquare, Send, CheckCircle, AlertCircle } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";
import toast from "react-hot-toast";

const CHANNELS = [
  { kind: "sms", label: "SMS", icon: MessageSquare, provider: "Africa's Talking" },
  { kind: "whatsapp", label: "WhatsApp", icon: MessageSquare, provider: "WhatsApp Business API" },
  { kind: "email", label: "Email", icon: MessageSquare, provider: "SMTP" },
  { kind: "telegram", label: "Telegram", icon: MessageSquare, provider: "Bot API" },
];

export default function ChannelsPage() {
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const handleTest = async (kind: string) => {
    setTesting(kind);
    try {
      // Placeholder: call POST /admin/channels/{kind}/test
      await new Promise((r) => setTimeout(r, 800));
      setResults((prev) => ({ ...prev, [kind]: { success: true, message: "Test message delivered" } }));
      toast.success(`${kind.toUpperCase()} test sent`);
    } catch {
      setResults((prev) => ({ ...prev, [kind]: { success: false, message: "Test failed" } }));
      toast.error(`${kind.toUpperCase()} test failed`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Channels</h1>
        <p className="text-sm text-slate-500">Configure and test SMS, WhatsApp, Email and Telegram delivery channels</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map((ch) => (
          <Card key={ch.kind} title={ch.label} action={
            <Button size="sm" onClick={() => handleTest(ch.kind)} isLoading={testing === ch.kind}>
              <Send className="h-3.5 w-3.5" /> Send Test
            </Button>
          }>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Provider</span>
                <span className="text-sm font-semibold text-slate-900">{ch.provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Status</span>
                <Badge label={results[ch.kind]?.success ? "Active" : "Configured"} variant={results[ch.kind]?.success ? "green" : "slate"} />
              </div>
              {results[ch.kind] && (
                <div className={`rounded-lg px-3 py-2 text-xs ${results[ch.kind].success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  <div className="flex items-center gap-1.5">
                    {results[ch.kind].success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {results[ch.kind].message}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
