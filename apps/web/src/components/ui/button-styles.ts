import { cn } from "../../lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonStyleOptions = {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "bg-ice-100 text-ink-950 shadow-sm hover:bg-ice-200 active:bg-ice-300",
  outline:
    "border border-ink-200 bg-white text-ink-950 shadow-sm hover:border-brand-300 hover:bg-ice-50",
  ghost: "text-ink-950 hover:bg-ice-100 active:bg-ice-200",
  danger:
    "bg-coral-600 text-white shadow-sm hover:bg-coral-700 active:bg-coral-700",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-base",
  icon: "size-11 rounded-xl",
};

export function buttonStyles({
  className,
  size = "md",
  variant = "primary",
}: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}
