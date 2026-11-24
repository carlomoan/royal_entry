"use client";
// Sandbox/delivery log: shows exactly what was sent to guests, including QR links and tokens.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Lock, MessageSquare, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { Badge, Button, Card, Select } from "@/components/ui";

type Channel = "sms" | "whatsapp" | "email" | "telegram";

type MessageLog = {
  id: string;
  event_id: string;
  guest_id: string | null;
  channel: Channel;
  recipient: string;
  subject: string | null;
  body: string;
  qr_url: string | null;
  token: string | null;
  provider_id: string | null;
  created_at: string;
};

const CHANNEL_STYLES: Record<Channel, string> = {
  sms: "bg-sky-100 text-sky-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  email: "bg-violet-100 text-violet-700",
  telegram: "bg-amber-100 text-amber-700",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessagesTab({ eventId, isDemo }: { eventId: string; isDemo?: boolean }) {
  const [channel, setChannel] = useState("");
  const qc = useQueryClient();
  const locked = isDemo === false;

  const { data: messages = [], isLoading, isError } = useQuery({
    queryKey: ["event-messages", eventId, channel],
    queryFn: async (): Promise<MessageLog[]> =>
      (await api.get(`/events/${eventId}/messages`, {
        params: { channel: channel || undefined, limit: 100 },
      })).data.data ?? [],
    enabled: !locked && !!eventId && eventId !== "undefined",
    refetchInterval: 15000,
  });

  if (locked) {
    return (
      <Card title="Message log">
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Lock className="h-8 w-8 text-slate-300" />
          <p className="max-w-md text-sm text-slate-600">
            Message inspection is available only for demo events and platform administrators.
          </p>
        </div>
      </Card>
    );
  }

  const counts = {
    total: messages.length,
    sms: messages.filter((m) => m.channel === "sms").length,
    whatsapp: messages.filter((m) => m.channel === "whatsapp").length,
    email: messages.filter((m) => m.channel === "email").length,
  };

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Codes are masked. Never share this view.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total messages", value: counts.total, className: "text-navy-950" },
          { label: "SMS", value: counts.sms, className: "text-sky-700" },
          { label: "WhatsApp", value: counts.whatsapp, className: "text-emerald-700" },
          { label: "Email", value: counts.email, className: "text-violet-700" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${stat.className}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <Card
        title="Message log"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="py-2"
            >
              <option value="">All channels</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="telegram">Telegram</option>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["event-messages", eventId] })}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading messages…</p>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-rose-700">
            Could not load messages. Try refreshing.
          </p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageSquare className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              No messages yet. Send invitations or a broadcast to see them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Time</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Channel</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Recipient</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Guest</th>
                  <th className="px-3 py-2 font-semibold">Content</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">QR/token</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Provider ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {messages.map((message) => (
                  <tr key={message.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                      {formatTime(message.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        label={message.channel}
                        className={CHANNEL_STYLES[message.channel] ?? "bg-slate-100 text-slate-700"}
                      />
                    </td>
                    <td className="max-w-[180px] break-words px-3 py-3 text-xs text-slate-700">
                      {message.recipient}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {message.guest_id ? (
                        <span className="font-mono" title={message.guest_id}>
                          {message.guest_id.slice(0, 8)}…
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-md px-3 py-3 text-xs text-slate-700">
                      {message.subject && (
                        <p className="mb-1 font-semibold text-slate-900">{message.subject}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {message.token && (
                        <span className="block break-all font-mono text-slate-700">{message.token}</span>
                      )}
                      {message.qr_url && (
                        <a
                          href={message.qr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 font-semibold text-gold-700 hover:underline"
                        >
                          Open QR <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {!message.token && !message.qr_url && "—"}
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                      {message.provider_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
