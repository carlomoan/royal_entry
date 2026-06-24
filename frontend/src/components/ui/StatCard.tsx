// ==============================================================================
// FILE: src/components/ui/StatCard.tsx
// ==============================================================================

import { cn } from "@/utils/cn";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  color?: "gold" | "green" | "blue" | "red" | "purple";
}

const colorMap = {
  gold: { bg: "bg-gold-50", icon: "text-gold-600", ring: "ring-gold-200" },
  green: { bg: "bg-green-50", icon: "text-green-600", ring: "ring-green-200" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600", ring: "ring-blue-200" },
  red: { bg: "bg-red-50", icon: "text-red-600", ring: "ring-red-200" },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    ring: "ring-purple-200",
  },
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color = "gold",
}: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <div className={cn("p-3 rounded-xl ring-1", c.bg, c.ring)}>
          <Icon className={cn("w-6 h-6", c.icon)} />
        </div>
      </div>
    </div>
  );
}
