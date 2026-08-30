import { LoaderCircle } from "lucide-react";
import { type HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  label?: string;
  size?: "sm" | "md" | "lg";
};

const spinnerSizeStyles: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

export function Spinner({
  className,
  label = "Cargando",
  size = "md",
  ...props
}: SpinnerProps) {
  return (
    <span
      className={cn("inline-flex items-center justify-center text-brand-600", className)}
      role="status"
      {...props}
    >
      <LoaderCircle
        aria-hidden="true"
        className={cn("animate-spin motion-reduce:animate-none", spinnerSizeStyles[size])}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export type LoadingSkeletonProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

export function LoadingSkeleton({
  className,
  label = "Cargando contenido",
  role,
  ...props
}: LoadingSkeletonProps) {
  return (
    <div
      className={cn("relative min-h-4 overflow-hidden rounded-lg bg-ice-100", className)}
      role={role ?? "status"}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-pulse bg-ice-200 motion-reduce:animate-none"
      />
    </div>
  );
}
