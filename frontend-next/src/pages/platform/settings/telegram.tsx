"use client";

import { Send, Save } from "lucide-react";
import { useState } from "react";
import { Card, Button, Input } from "@/components/ui";

export default function TelegramConfigPage() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Telegram Config</h1>
        <p className="text-sm text-slate-500">Configure Telegram bot for messaging</p>
      </div>
      <Card title="Telegram Bot">
        <div className="space-y-4">
          <Input label="Bot Token" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="Enter Telegram bot token" />
          <Input label="Chat ID" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Enter default chat ID" />
          <div className="flex justify-end">
            <Button><Save className="h-4 w-4" /> Save</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
