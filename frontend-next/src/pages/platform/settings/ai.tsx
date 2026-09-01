"use client";

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui";

export default function AIIntegrationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Integration</h1>
        <p className="text-sm text-slate-500">Configure AI-powered features for event management</p>
      </div>
      <Card title="AI Features">
        <div className="space-y-3 text-sm text-slate-600">
          <p><strong>Guest Prediction:</strong> AI predicts attendance based on RSVP patterns.</p>
          <p><strong>Smart Reminders:</strong> AI-optimized reminder timing for pledge payments.</p>
          <p><strong>Content Generation:</strong> Auto-generate invitation messages and event descriptions.</p>
          <p><strong>Analytics:</strong> AI-driven insights from event data.</p>
        </div>
      </Card>
    </div>
  );
}
