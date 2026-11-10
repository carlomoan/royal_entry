"use client";
import {
  SlidersHorizontal, Palette, FileText, ShieldCheck, Webhook, ScrollText,
  Sparkles, MessageCircle, MessageSquare, Send, Landmark,
} from "lucide-react";
import SettingsTabs from "@/components/settings/SettingsTabs";
import TaxSection from "@/components/settings/sections/TaxSection";
import GlobalVariablesSection from "@/components/settings/sections/GlobalVariablesSection";
import CardTemplatesSection from "@/components/settings/sections/CardTemplatesSection";
import EmailTemplatesSection from "@/components/settings/sections/EmailTemplatesSection";
import RbacSection from "@/components/settings/sections/RbacSection";
import WebhooksSection from "@/components/settings/sections/WebhooksSection";
import AuditSection from "@/components/settings/sections/AuditSection";
import WhatsAppSection from "@/components/settings/sections/WhatsAppSection";
import SmsSection from "@/components/settings/sections/SmsSection";
import AiSection from "@/components/settings/sections/AiSection";
import TelegramSection from "@/components/settings/sections/TelegramSection";

export default function PlatformSettingsPage() {
  const tabs = [
    { id: "tax", label: "Tax & TRA", icon: Landmark, content: <TaxSection /> },
    { id: "global-variables", label: "Global Variables", icon: SlidersHorizontal, content: <GlobalVariablesSection /> },
    { id: "card-templates", label: "Card Templates", icon: Palette, content: <CardTemplatesSection /> },
    { id: "email-templates", label: "Email Templates", icon: FileText, content: <EmailTemplatesSection /> },
    { id: "roles", label: "Roles & Permissions", icon: ShieldCheck, content: <RbacSection /> },
    { id: "webhooks", label: "Webhooks", icon: Webhook, content: <WebhooksSection /> },
    { id: "audit", label: "Audit Logs", icon: ScrollText, content: <AuditSection /> },
    { id: "whatsapp", label: "WhatsApp Config", icon: MessageCircle, content: <WhatsAppSection /> },
    { id: "sms", label: "SMS Config", icon: MessageSquare, content: <SmsSection /> },
    { id: "ai", label: "AI Integration", icon: Sparkles, content: <AiSection /> },
    { id: "telegram", label: "Telegram Config", icon: Send, content: <TelegramSection /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Platform configuration — select a tab to manage it</p>
      </div>
      <SettingsTabs tabs={tabs} />
    </div>
  );
}