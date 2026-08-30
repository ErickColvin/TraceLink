import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm text-ink-950 shadow-sm transition-colors",
        "placeholder:text-ink-400 hover:border-ink-300",
        "focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200",
        "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60",
        "aria-[invalid=true]:border-coral-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-coral-100",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
