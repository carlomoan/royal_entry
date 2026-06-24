// ==============================================================================
// FILE: src/components/ui/Button.tsx
// ==============================================================================

import { cn } from "@/utils/cn";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variants = {
  primary:
    "bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 text-navy-950 shadow-lg shadow-gold-500/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gold-500/30",
  secondary:
    "bg-gradient-to-r from-navy-800 to-navy-700 text-white shadow-lg shadow-navy-900/15 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-navy-900/20",
  danger:
    "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/20 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-500/25",
  ghost:
    "border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md",
};

const sizes = {
  sm: "px-3.5 py-2 text-xs rounded-xl",
  md: "px-4.5 py-2.5 text-sm rounded-2xl",
  lg: "px-6 py-3.5 text-base rounded-2xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  isLoading,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200",
        "focus:outline-none focus:ring-4 focus:ring-gold-100 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
