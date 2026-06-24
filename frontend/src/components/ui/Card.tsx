// ==============================================================================
// FILE: src/components/ui/Card.tsx
// ==============================================================================

import { cn } from "@/utils/cn";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export default function Card({
  title,
  children,
  className,
  action,
}: CardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[26px] border border-white/80 bg-white/90 shadow-lg shadow-slate-200/60 backdrop-blur-sm",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100/90 px-6 py-5">
          {title ? (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                {title}
              </h3>
            </div>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
