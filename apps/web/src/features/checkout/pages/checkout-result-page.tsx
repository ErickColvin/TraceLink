import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { PaymentLifecycleStatus } from "@tracelink/contracts";

import { PageHeader, RequestIdReference } from "@/components";
import { Alert, Button, Card, CardContent, buttonStyles } from "@/components/ui";
import { useCurrentCustomerOrder } from "@/features/orders/queries/order-queries";
import { toOperationalError } from "@/lib/http/operational-error";

import {
  clearPendingCheckout,
  readPendingCheckout,
} from "../pending-checkout";

const POLLING_INTERVAL_MS = 4_000;
const POLLING_WINDOW_MS = 2 * 60_000;
const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentLifecycleStatus> = new Set([
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
  "ERROR",
]);

const STATUS_COPY = {
  approved: {
    icon: CheckCircle2,
    title: "Pago recibido",
    description: "El backend confirmó el pago. Estamos preparando tu pedido para retiro.",
  },
  pending: {
    icon: Clock3,
    title: "Pago pendiente",
    description: "El proveedor aún está procesando el pago. Consultaremos el estado durante un tiempo limitado.",
  },
  rejected: {
    icon: AlertTriangle,
    title: "Pago no aprobado",
    description: "Puedes volver al pedido y generar otro intento si la reserva sigue disponible.",
  },
} as const;

function displayStatus(
  returnStatus: string | null,
  paymentStatus: PaymentLifecycleStatus | undefined,
): keyof typeof STATUS_COPY {
  if (paymentStatus === "APPROVED" || paymentStatus === "REFUNDED") return "approved";
  if (
    paymentStatus === "REJECTED" ||
    paymentStatus === "CANCELLED" ||
    paymentStatus === "ERROR"
  ) return "rejected";
  if (paymentStatus !== undefined) return "pending";
  return returnStatus === "approved" || returnStatus === "rejected"
    ? returnStatus
    : "pending";
}

function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutesPart = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secondsPart = (seconds % 60).toString().padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
}

export function CheckoutResultPage() {
  const [params] = useSearchParams();
  const [pendingCheckout] = useState(readPendingCheckout);
  const [now, setNow] = useState(Date.now);
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const pollingStartedAt = useRef<number | null>(null);
  const expiryRefreshIssued = useRef(false);
  const orderQuery = useCurrentCustomerOrder(pendingCheckout?.orderId);
  const {
    data: order,
    error: orderError,
    isError: orderIsError,
    isFetching: orderIsFetching,
    isPending: orderIsPending,
    refetch: refetchOrder,
  } = orderQuery;
  const paymentStatus = order?.paymentDetails?.payment.status;
  const terminal = paymentStatus !== undefined && TERMINAL_PAYMENT_STATUSES.has(paymentStatus);
  const status = displayStatus(params.get("status"), paymentStatus);
  const copy = STATUS_COPY[status];
  const Icon = copy.icon;
  const reservationExpiresAt = pendingCheckout === null
    ? null
    : Date.parse(pendingCheckout.reservationExpiresAt);
  const reservationRemaining = reservationExpiresAt === null
    ? null
    : Math.max(0, reservationExpiresAt - now);

  useEffect(() => {
    if (terminal) clearPendingCheckout();
  }, [terminal]);

  useEffect(() => {
    if (reservationRemaining === null || reservationRemaining <= 0) return;
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1_000);
    return () => globalThis.clearInterval(timer);
  }, [reservationRemaining]);

  useEffect(() => {
    if (
      pendingCheckout === null ||
      reservationRemaining === null ||
      reservationRemaining > 0 ||
      expiryRefreshIssued.current
    ) return;

    expiryRefreshIssued.current = true;
    void refetchOrder();
  }, [pendingCheckout, refetchOrder, reservationRemaining]);

  useEffect(() => {
    if (pendingCheckout === null || terminal || pollingExhausted) return;
    pollingStartedAt.current ??= Date.now();

    const timer = globalThis.setInterval(() => {
      const startedAt = pollingStartedAt.current;
      if (startedAt !== null && Date.now() - startedAt >= POLLING_WINDOW_MS) {
        setPollingExhausted(true);
        globalThis.clearInterval(timer);
        return;
      }
      void refetchOrder();
    }, POLLING_INTERVAL_MS);

    return () => globalThis.clearInterval(timer);
  }, [pendingCheckout, pollingExhausted, refetchOrder, terminal]);

  const queryError = orderIsError
    ? toOperationalError(
        orderError,
        "No pudimos consultar el estado actual del pedido.",
      )
    : null;

  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <PageHeader
          eyebrow="Resultado de pago"
          title={copy.title}
          description="El retorno del proveedor es informativo; solo el backend confirma y modifica el estado del pago."
        />
        <Card className="mt-8">
          <CardContent className="py-9 text-center sm:py-12">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-100 text-brand-800">
              <Icon aria-hidden="true" className="size-8" />
            </span>
            <p className="mx-auto mt-5 max-w-xl leading-7 text-ink-600">
              {copy.description}
            </p>

            {pendingCheckout !== null ? (
              <div className="mx-auto mt-5 max-w-xl rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-sm text-ink-700">
                {reservationRemaining !== null && reservationRemaining > 0 ? (
                  <p>
                    Reserva informativa: <strong>{formatCountdown(reservationRemaining)}</strong>.
                    El servidor mantiene la autoridad sobre su vigencia.
                  </p>
                ) : (
                  <p>
                    El plazo mostrado terminó. Consultamos nuevamente al backend; el navegador no libera inventario.
                  </p>
                )}
              </div>
            ) : (
              <Alert className="mx-auto mt-5 max-w-xl text-left" tone="warning">
                No encontramos el contexto local del checkout. Revisa el estado autoritativo en Mis pedidos.
              </Alert>
            )}

            {orderIsFetching && !orderIsPending ? (
              <p className="mt-4 text-sm text-ink-500" role="status">
                Consultando el estado actual…
              </p>
            ) : null}
            {pollingExhausted && !terminal ? (
              <Alert className="mx-auto mt-5 max-w-xl text-left" tone="info">
                La actualización automática terminó para evitar consultas indefinidas. Puedes actualizar manualmente.
              </Alert>
            ) : null}
            {queryError ? (
              <Alert className="mx-auto mt-5 max-w-xl text-left" tone="danger">
                <p>{queryError.message}</p>
                <RequestIdReference requestId={queryError.requestId} />
              </Alert>
            ) : null}

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              {pendingCheckout !== null ? (
                <Button
                  variant="outline"
                  disabled={orderIsFetching}
                  onClick={() => void refetchOrder()}
                >
                  <RefreshCw aria-hidden="true" />
                  Actualizar
                </Button>
              ) : null}
              {order ? (
                <Link
                  to={`/mi-cuenta/pedidos/${order.id}`}
                  className={buttonStyles()}
                >
                  Ver este pedido
                </Link>
              ) : (
                <Link to="/mi-cuenta/pedidos" className={buttonStyles()}>
                  Ver mis pedidos
                </Link>
              )}
              <Link to="/productos" className={buttonStyles({ variant: "outline" })}>
                Seguir comprando
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
