import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export type AlertTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneStyles: Record<AlertTone, string> = {
  neutral: "border-ink-200 bg-ink-50 text-ink-950",
  info: "border-brand-200 bg-ice-50 text-ink-950",
  success: "border-brand-200 bg-brand-50 text-ink-950",
  warning: "border-coral-200 bg-coral-50 text-ink-950",
  danger: "border-coral-300 bg-coral-100 text-ink-950",
};

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, role, tone = "neutral", ...props }, ref) => (
    <div
      ref={ref}
      role={role ?? (tone === "danger" ? "alert" : undefined)}
      className={cn(
        "relative w-full rounded-xl border px-4 py-3 text-sm",
        "[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4",
        "[&>svg~*]:pl-7",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  ),
);

Alert.displayName = "Alert";

export const AlertTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h4 ref={ref} className={cn("font-semibold leading-snug", className)} {...props} />
));

AlertTitle.displayName = "AlertTitle";

export const AlertDescription = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-sm leading-relaxed text-ink-700 [&_p]:leading-relaxed",
      className,
    )}
    {...props}
  />
));

AlertDescription.displayName = "AlertDescription";
