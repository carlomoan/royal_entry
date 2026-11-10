"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface SettingsTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  content: React.ReactNode;
}

export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Vertical tab list */}
      <div className="flex w-full shrink-0 flex-col gap-1 lg:w-64">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
              active === id
                ? "bg-navy-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {badge && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", active === id ? "bg-gold-500 text-navy-950" : "bg-slate-100 text-slate-500")}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active section content */}
      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {current?.content}
      </div>
    </div>
  );
}