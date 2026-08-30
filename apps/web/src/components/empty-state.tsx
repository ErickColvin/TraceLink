import { PackageOpen } from "lucide-react";
import { type ReactNode, useId } from "react";

import { cn } from "../lib/cn";

export type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
}: EmptyStateProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white px-5 py-10 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-4 inline-grid size-12 place-items-center rounded-2xl bg-ice-100 text-brand-700 [&>svg]:size-6"
      >
        {icon ?? <PackageOpen />}
      </span>
      <h2 id={titleId} className="text-base font-semibold text-ink-950 sm:text-lg">
        {title}
      </h2>
      {description ? (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-ink-600">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </section>
  );
}
