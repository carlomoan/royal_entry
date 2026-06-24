import { forwardRef } from "react";
import { cn } from "@/utils/cn";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

// 1. Wrap the component in forwardRef to accept a ref from parent components
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          id={inputId}
          className={cn(
            "border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white",
            "placeholder:text-gray-400 outline-none transition-all",
            "focus:ring-2 focus:ring-gold-400 focus:border-transparent",
            error ? "border-red-400" : "border-gray-300",
            className,
          )}
          ref={ref} // 👈 2. Attach the forwarded ref to the actual HTML input element
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);

// 3. Set a display name for better debugging in React DevTools
Input.displayName = "Input";

export default Input;
