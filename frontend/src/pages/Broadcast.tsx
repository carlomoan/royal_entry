// ==============================================================================
// FILE: src/pages/Broadcast.tsx
// ==============================================================================

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquareShare,
  Radio,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { broadcastApi } from "@/api/broadcast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDateTime, timeAgo } from "@/utils/format";
import { cn } from "@/utils/cn";

const TARGETS = ["all", "vip", "confirmed", "declined", "not_rsvp"];
const CHANNELS = ["whatsapp", "sms", "both"];

export default function Broadcast() {
  const { id: eventId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [target, setTarget] = useState("all");
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(
    null,
  );

  const { data: campaigns = [] } = useQuery({
    queryKey: ["broadcasts", eventId],
    queryFn: () => broadcastApi.list(eventId!),
    enabled: !!eventId,
  });

  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery({
    queryKey: ["broadcast-deliveries", eventId, expandedCampaignId],
    queryFn: () => broadcastApi.deliveries(eventId!, expandedCampaignId!),
    enabled: !!eventId && !!expandedCampaignId,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      broadcastApi.send(eventId!, {
        campaign_name: name || undefined,
        message,
        channel,
        target,
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["broadcasts", eventId] });
      toast.success(
        `Broadcast processed: ${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}`,
      );
      setExpandedCampaignId(r.campaign_id);
      setMessage("");
      setName("");
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Failed to send broadcast",
      ),
  });

  const remaining = 1600 - message.length;
  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => {
        acc.totalCampaigns += 1;
        acc.sent += campaign.successfully_sent;
        acc.failed += campaign.failed_count;
        acc.audience += campaign.total_recipients ?? 0;
        return acc;
      },
      { totalCampaigns: 0, sent: 0, failed: 0, audience: 0 },
    );
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          {
            label: "Campaigns",
            value: totals.totalCampaigns,
            tone: "from-slate-900 to-slate-700 text-white",
          },
          {
            label: "Audience reached",
            value: totals.sent,
            tone: "from-emerald-500 to-emerald-600 text-white",
          },
          {
            label: "Delivery failures",
            value: totals.failed,
            tone: "from-rose-500 to-rose-600 text-white",
          },
          {
            label: "Total recipients",
            value: totals.audience,
            tone: "from-gold-400 to-gold-600 text-navy-950",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-[26px] bg-gradient-to-br p-5 shadow-lg",
              item.tone,
            )}
          >
            <p className="text-sm opacity-85">{item.label}</p>
            <p className="mt-2 text-3xl font-black">{item.value}</p>
          </div>
        ))}
      </div>

      <Card
        title="Send a new message"
        className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
        action={<Badge label={channel} />}
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Campaign name
              </label>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
                placeholder="e.g. Venue change alert"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-xs font-semibold capitalize transition",
                      channel === c
                        ? "border-navy-900 bg-navy-900 text-white shadow-lg shadow-navy-900/15"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Audience
              </label>
              <select
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {TARGETS.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t === "not_rsvp"
                      ? "Not yet RSVP'd"
                      : t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-white p-5">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Message
            </label>
            <textarea
              rows={5}
              maxLength={1600}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-gold-400 focus:ring-4 focus:ring-gold-100"
              placeholder="Type your update in simple, friendly language. Example: Karibu, the venue gate opens at 4:30 PM."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="mt-3 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <p>
                Your message will be sent via{" "}
                <strong className="text-slate-700">{channel}</strong> to{" "}
                <strong className="text-slate-700">{target}</strong> guests.
              </p>
              <p
                className={cn(
                  remaining < 100 ? "text-rose-600" : "text-slate-400",
                )}
              >
                {remaining} characters remaining
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Users className="h-4 w-4 text-gold-600" /> Clear, respectful
              messaging works best for guests and family.
            </div>
            <Button
              onClick={() => sendMutation.mutate()}
              isLoading={sendMutation.isPending}
              disabled={!message.trim()}
            >
              <Send className="h-4 w-4" /> Send broadcast
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title={`Broadcast history (${campaigns.length})`}
        className="border-0 bg-white/95 shadow-xl shadow-slate-200/70"
      >
        {campaigns.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
            <Radio className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-semibold text-slate-700">
              No broadcasts sent yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Send your first message above and delivery results will appear
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const isExpanded = expandedCampaignId === campaign.id;
              return (
                <div
                  key={campaign.id}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCampaignId(isExpanded ? null : campaign.id)
                    }
                    className="flex w-full flex-col gap-4 px-5 py-5 text-left transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-slate-900">
                          {campaign.campaign_name ?? "Untitled broadcast"}
                        </p>
                        <Badge label={campaign.status} />
                        <Badge label={campaign.message_channel} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        Audience:{" "}
                        <strong className="text-slate-700">
                          {campaign.target_audience.replace("_", " ")}
                        </strong>
                        {" · "}
                        Sent {timeAgo(campaign.sent_at ?? campaign.created_at)}
                        {" · "}
                        {formatDateTime(
                          campaign.sent_at ?? campaign.created_at,
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-emerald-700">
                        <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                          <CheckCircle2 className="h-4 w-4" /> Sent
                        </div>
                        <p className="mt-1 text-xl font-black">
                          {campaign.successfully_sent}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-rose-50 px-4 py-3 text-center text-rose-700">
                        <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                          <XCircle className="h-4 w-4" /> Failed
                        </div>
                        <p className="mt-1 text-xl font-black">
                          {campaign.failed_count}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5">
                      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <MessageSquareShare className="h-4 w-4 text-gold-600" />
                        Delivery details
                      </div>
                      {deliveriesLoading ? (
                        <p className="text-sm text-slate-500">
                          Loading delivery results…
                        </p>
                      ) : deliveries.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No delivery records found for this campaign yet.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Guest</th>
                                <th className="px-4 py-3">Channel</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Details</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {deliveries.map((delivery) => (
                                <tr key={delivery.id}>
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-slate-900">
                                      {delivery.guest_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {delivery.guest_phone}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge label={delivery.channel} />
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge label={delivery.status} />
                                  </td>
                                  <td className="px-4 py-3 text-slate-500">
                                    {formatDateTime(delivery.delivered_at)}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500">
                                    {delivery.error_message ||
                                      delivery.provider_message_id ||
                                      "Delivered successfully"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
