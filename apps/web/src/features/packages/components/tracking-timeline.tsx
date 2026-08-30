import { AlertTriangle, Check, Circle, MapPin } from "lucide-react";
import type { PackageStatus, TrackingEvent } from "@/features/packages";
import { getPackageStatusMeta } from "@/features/packages/presentation/package-status";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/formatters";

const standardJourney: readonly PackageStatus[] = [
  "EXPECTED",
  "RECEIVED",
  "STORED",
  "READY_FOR_PICKUP",
  "PICKED_UP",
];

const exceptionStatuses: readonly PackageStatus[] = ["RETURNED", "LOST", "INCIDENT"];

type TrackingTimelineProps = {
  currentStatus: PackageStatus;
  events: readonly TrackingEvent[];
};

export function TrackingTimeline({ currentStatus, events }: TrackingTimelineProps) {
  const chronologicalEvents = [...events].sort(
    (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
  );
  const completedStandardStatuses = new Set(
    chronologicalEvents
      .map((event) => event.status)
      .filter((status) => standardJourney.includes(status)),
  );
  const highestCompletedStandardIndex = chronologicalEvents.reduce(
    (highestIndex, event) =>
      Math.max(highestIndex, standardJourney.indexOf(event.status)),
    -1,
  );
  const currentEventId = chronologicalEvents
    .filter((event) => event.status === currentStatus)
    .at(-1)?.id;
  const steps = [
    ...chronologicalEvents.map((event) => ({
      kind: "event" as const,
      status: event.status,
      event,
    })),
    ...standardJourney
      .filter(
        (status, index) =>
          index > highestCompletedStandardIndex &&
          !completedStandardStatuses.has(status),
      )
      .map((status) => ({ kind: "pending" as const, status })),
  ];

  return (
    <ol className="relative" aria-label="Historial de trazabilidad">
      {steps.map((step, index) => {
        const event = step.kind === "event" ? step.event : undefined;
        const { status } = step;
        const isException = exceptionStatuses.includes(status);
        const isCurrent = event
          ? event.id === currentEventId
          : status === currentStatus;
        const isCompleted = Boolean(event) && !isCurrent;
        const isUpcoming = step.kind === "pending";
        const meta = getPackageStatusMeta(status);
        const isLast = index === steps.length - 1;

        return (
          <li
            key={event?.id ?? `pending-${status}`}
            aria-current={isCurrent ? "step" : undefined}
            className="relative grid grid-cols-[2.75rem_1fr] gap-3 pb-7 last:pb-0 sm:grid-cols-[3.25rem_1fr] sm:gap-4"
          >
            {!isLast ? (
              <span aria-hidden="true" className={cn("absolute bottom-0 left-[1.34rem] top-10 w-0.5 sm:left-[1.59rem]", event ? "bg-brand-200" : "bg-ink-100")} />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 grid size-11 place-items-center rounded-full border-4 border-white sm:size-13",
                isException && "bg-coral-100 text-coral-700 ring-1 ring-coral-200",
                !isException && isCurrent && "bg-brand-700 text-white ring-4 ring-brand-100",
                !isException && isCompleted && "bg-brand-100 text-brand-800 ring-1 ring-brand-200",
                isUpcoming && "bg-ink-50 text-ink-400 ring-1 ring-ink-200",
              )}
            >
              {isException ? <AlertTriangle className="size-5" /> : isCompleted ? <Check className="size-5" /> : <Circle className={cn("size-4", isCurrent && "fill-current")} />}
            </span>
            <div className={cn("min-w-0 rounded-2xl border p-4 sm:p-5", isException ? "border-coral-200 bg-coral-50" : isCurrent ? "border-brand-200 bg-brand-50" : isUpcoming ? "border-ink-100 bg-ink-50/60" : "border-ink-100 bg-white")}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <h3 className={cn("font-bold", isUpcoming ? "text-ink-500" : "text-ink-950")}>{meta.label}</h3>
                {event ? <time dateTime={event.occurredAt} className="text-xs font-semibold text-ink-500">{formatDateTime(event.occurredAt)}</time> : <span className="text-xs font-semibold text-ink-400">Pendiente</span>}
              </div>
              <p className={cn("mt-2 text-sm leading-6", isUpcoming ? "text-ink-500" : "text-ink-600")}>{event?.description ?? meta.description}</p>
              {event?.location ? <p className="mt-3 inline-flex items-start gap-1.5 text-xs font-semibold text-ink-600"><MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-700" /> {event.location}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
