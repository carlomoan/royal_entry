"use client";
import { useState } from "react";
import { Send, Clock, Palette, FileText, CheckSquare } from "lucide-react";
import { Card, Badge, Button, Input, Select } from "@/components/ui";
import toast from "react-hot-toast";

export function BroadcastForm({ eventId }: { eventId: string }) {
  const [selectedCard, setSelectedCard] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["sms", "whatsapp"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState("");

  const handleChannelToggle = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Broadcast queued with card/template selectors");
  };

  return (
    <Card title="Broadcast" action={<Badge label="Updated" variant="gold" />}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Card Template" value={selectedCard} onChange={(e) => setSelectedCard(e.target.value)}>
          <option value="">Select card template</option>
          <option value="vip">VIP Invitation</option>
          <option value="standard">Standard Invitation</option>
        </Select>

        <Select label="Message Template" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
          <option value="">Select message template (optional)</option>
          <option value="welcome">Welcome Invitation</option>
          <option value="reminder">Reminder Notice</option>
        </Select>

        <div>
          <label className="text-xs font-semibold text-slate-600">Channels</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["sms", "whatsapp", "email", "telegram"].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => handleChannelToggle(ch)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedChannels.includes(ch)
                    ? "bg-gold-500 text-navy-950 shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {ch.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Schedule (optional)"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />

        <Input label="Custom message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />

        <div className="flex justify-end gap-2">
          <Button type="submit" size="sm"><Send className="h-3.5 w-3.5" /> Send Broadcast</Button>
        </div>
      </form>
    </Card>
  );
}
