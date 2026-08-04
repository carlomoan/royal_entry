import { forwardRef } from "react";
import { cn } from "@/utils/cn";
import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <select
          id={inputId}
          className={cn(
            "border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white",
            "placeholder:text-gray-400 outline-none transition-all",
            "focus:ring-2 focus:ring-gold-400 focus:border-transparent",
            error ? "border-red-400" : "border-gray-300",
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;