import { type ReactNode, useId } from "react";

import { cn } from "../lib/cn";

export type SectionHeadingProps = {
  actions?: ReactNode;
  align?: "start" | "center";
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function SectionHeading({
  actions,
  align = "start",
  className,
  description,
  eyebrow,
  title,
}: SectionHeadingProps) {
  const titleId = useId();

  return (
    <div
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "items-center text-center sm:flex-col sm:items-center",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-700">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={titleId}
          className="font-display text-xl font-bold tracking-tight text-ink-950 sm:text-2xl"
        >
          {title}
        </h2>
        {description ? (
          <div className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-base">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
