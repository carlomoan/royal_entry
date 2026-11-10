"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { Card, Button, Input } from "@/components/ui";

export default function TelegramSection() {
  const qc = useQueryClient();
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/settings/system")).data.data,
  });
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  useEffect(() => {
    // Secrets come back masked — treat as write-only (blank keeps the saved token).
    setBotToken(settings?.telegram_bot_token === "********" ? "" : (settings?.telegram_bot_token ?? ""));
    if (settings?.telegram_chat_id) setChatId(settings.telegram_chat_id);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.put("/settings/system", { settings: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["system-settings"] }); toast.success("Telegram config saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Telegram Config</h1>
        <p className="text-sm text-slate-500">Configure Telegram bot for messaging</p>
      </div>
      <Card title="Telegram Bot">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="space-y-4">
            <Input label="Bot Token" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={botToken ? "Enter Telegram bot token" : "Saved — leave blank to keep"} />
            <Input label="Default Chat ID" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Enter default chat ID" />
            <div className="flex justify-end">
              <Button onClick={() => {
                const payload: Record<string, unknown> = { telegram_chat_id: chatId };
                if (botToken.trim()) payload.telegram_bot_token = botToken;
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