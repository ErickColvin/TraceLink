import { CircleAlert } from "lucide-react";
import { type ReactNode, useId } from "react";

import { cn } from "../lib/cn";

export type ErrorStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
};

export function ErrorState({
  action,
  className,
  description,
  title,
}: ErrorStateProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-2xl border border-coral-200 bg-coral-50 px-5 py-10 text-center",
        className,
      )}
      role="alert"
    >
      <span
        aria-hidden="true"
        className="mb-4 inline-grid size-12 place-items-center rounded-2xl bg-white text-coral-600 shadow-sm"
      >
        <CircleAlert className="size-6" />
      </span>
      <h2 id={titleId} className="text-base font-semibold text-ink-950 sm:text-lg">
        {title}
      </h2>
      {description ? (
        <div className="mt-2 max-w-md text-sm leading-relaxed text-ink-700">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </section>
  );
}
