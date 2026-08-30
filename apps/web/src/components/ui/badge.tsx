import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-ink-50 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  info: "bg-ice-100 text-brand-900 ring-ice-300",
  success: "bg-brand-50 text-brand-900 ring-brand-200",
  warning: "bg-coral-50 text-coral-700 ring-coral-200",
  danger: "bg-coral-100 text-coral-700 ring-coral-300",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "neutral", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ring-1 ring-inset",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
