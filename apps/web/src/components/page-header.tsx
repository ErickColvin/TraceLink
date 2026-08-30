import { type ReactNode, useId } from "react";

import { cn } from "../lib/cn";

export type PageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  const titleId = useId();

  return (
    <header
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-4 border-b border-ink-100 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-700">
            {eyebrow}
          </p>
        ) : null}
        <h1
          id={titleId}
          className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl"
        >
          {title}
        </h1>
        {description ? (
          <div className="mt-2 text-sm leading-relaxed text-ink-600 sm:text-base">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
