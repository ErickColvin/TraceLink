import { cn } from "../lib/cn";

export type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  name: string;
  shortName: string;
  size?: "sm" | "md" | "lg";
};

const sizeStyles: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "size-8 rounded-lg text-xs",
  md: "size-10 rounded-xl text-xs",
  lg: "size-12 rounded-2xl text-sm",
};

export function BrandLogo({
  className,
  compact = false,
  name,
  shortName,
  size = "md",
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-ink-950", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-grid shrink-0 place-items-center bg-brand-600 font-black uppercase tracking-wider text-white shadow-sm",
          sizeStyles[size],
        )}
      >
        {shortName}
      </span>
      {compact ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className="text-base font-extrabold tracking-tight sm:text-lg">
          {name}
        </span>
      )}
    </span>
  );
}
