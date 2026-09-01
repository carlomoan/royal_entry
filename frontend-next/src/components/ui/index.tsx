"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Loader2 } from "lucide-react";

export { Loader2 };

/* ── Button ─────────────────────────────────────────────────────────────── */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const buttonVariants = {
  primary:
    "bg-gold-500 text-navy-950 shadow-sm hover:bg-gold-600 focus:ring-gold-200",
  secondary:
    "bg-navy-900 text-white shadow-sm hover:bg-navy-800 focus:ring-navy-200",
  danger: "bg-red-500 text-white shadow-sm hover:bg-red-600 focus:ring-red-200",
  ghost:
    "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-slate-200",
  outline:
    "border border-gold-400 text-gold-700 bg-transparent hover:bg-gold-50 focus:ring-gold-100",
};

const buttonSizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200",
        "focus:outline-none focus:ring-4 disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────── */

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm animate-fadeIn",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          {title && (
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ── StatCard ───────────────────────────────────────────────────────────── */

const statColors = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  gold: "bg-amber-50 text-amber-600",
  purple: "bg-violet-50 text-violet-600",
  red: "bg-red-50 text-red-600",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
  growth,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: keyof typeof statColors;
  growth?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg animate-fadeIn">
      <div className={cn("absolute inset-x-0 top-0 h-[3px] opacity-60 transition-opacity duration-300 group-hover:opacity-100", statColors[color].split(" ")[0])} />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
          <p className="mt-2 truncate text-[28px] font-extrabold leading-none text-slate-900">{value}</p>
          {subtitle && <p className="mt-1.5 truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={cn(
          "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110",
          statColors[color]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {growth && (
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
          ↑ {growth}
        </div>
      )}
    </div>
  );
}

/* ── Badge ──────────────────────────────────────────────────────────────── */

const badgeVariants: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-violet-100 text-violet-700",
  cancelled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
  pending_review: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  failed: "bg-rose-100 text-rose-700",
  success: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
  gold: "bg-amber-100 text-amber-700",
  blue: "bg-sky-100 text-sky-700",
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

export function Badge({
  label,
  variant,
  className,
}: {
  label: string;
  variant?: string;
  className?: string;
}) {
  const key = (variant ?? label)?.toLowerCase().replace(/_/g, "_");
  const style =
    badgeVariants[key] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        style,
        className
      )}
    >
      {label?.toString().replace(/_/g, " ")}
    </span>
  );
}

/* ── Input ──────────────────────────────────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-600">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm outline-none transition-all",
            "placeholder:text-slate-300 focus:ring-2",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-slate-200 focus:border-gold-400 focus:ring-gold-100",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

/* ── Select ─────────────────────────────────────────────────────────────── */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-600">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          "rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all",
          "focus:border-gold-400 focus:ring-2 focus:ring-gold-100",
          error && "border-red-300",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ── Textarea ───────────────────────────────────────────────────────────── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-600">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition-all",
          "focus:border-gold-400 focus:ring-2 focus:ring-gold-100",
          error && "border-red-300",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────────────────────── */

export function Modal({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full rounded-xl bg-white shadow-2xl animate-scaleIn",
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}