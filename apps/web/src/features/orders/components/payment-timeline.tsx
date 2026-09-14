import { CircleDot } from "lucide-react";
import type {
  PaymentDetails,
  PaymentLifecycleStatus,
} from "@tracelink/contracts";

import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";

const STATUS_LABELS: Readonly<Record<PaymentLifecycleStatus, string>> = {
  CREATED: "Creado",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  ERROR: "Error",
};

function statusTone(status: PaymentLifecycleStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED" || status === "ERROR") return "danger" as const;
  if (status === "CANCELLED" || status === "REFUNDED") return "neutral" as const;
  return "warning" as const;
}

export function PaymentTimeline({ details }: Readonly<{ details?: PaymentDetails }>) {
  if (!details) {
    return (
      <p className="text-sm leading-6 text-ink-600">
        Este pedido no tiene eventos de pago asociados.
      </p>
    );
  }

  const { payment, attempts, refund } = details;
  const paymentOccurredAt =
    payment.refundedAt ?? payment.cancelledAt ?? payment.approvedAt ?? payment.updatedAt;

  const events = [
    {
      id: `payment-${payment.id}-created`,
      title: "Checkout creado",
      description: `Proveedor ${payment.provider}.`,
      status: "CREATED" as const,
      occurredAt: payment.createdAt,
    },
    ...attempts.map((attempt) => ({
      id: attempt.id,
      title: `Intento ${attempt.attemptNumber}: ${STATUS_LABELS[attempt.status]}`,
      description: attempt.errorMessage ?? "Solicitud de pago registrada por el backend.",
      status: attempt.status,
      occurredAt: attempt.completedAt ?? attempt.updatedAt,
    })),
    {
      id: `payment-${payment.id}-current`,
      title: `Pago ${STATUS_LABELS[payment.status].toLocaleLowerCase("es-CL")}`,
      description: payment.providerStatusDetail
        ? `Estado informado por el proveedor: ${payment.providerStatusDetail}.`
        : "Estado autoritativo actual registrado por TraceLink.",
      status: payment.status,
      occurredAt: paymentOccurredAt,
    },
    ...(refund === undefined
      ? []
      : [{
          id: refund.id,
          title: `Refund ${STATUS_LABELS[refund.status].toLocaleLowerCase("es-CL")}`,
          description: refund.reason,
          status: refund.status,
          occurredAt: refund.completedAt ?? refund.requestedAt,
        }]),
  ];

  return (
    <ol className="space-y-0" aria-label="Línea de tiempo del pago">
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
          {index < events.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[9px] top-5 h-full w-px bg-ink-200"
            />
          ) : null}
          <CircleDot
            aria-hidden="true"
            className="relative mt-0.5 size-5 shrink-0 text-brand-700"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-900">{event.title}</span>
              <Badge tone={statusTone(event.status)}>{STATUS_LABELS[event.status]}</Badge>
            </div>
            <time dateTime={event.occurredAt} className="mt-1 block text-xs text-ink-500">
              {formatDateTime(event.occurredAt)}
            </time>
            <p className="mt-2 text-sm leading-6 text-ink-600">{event.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
