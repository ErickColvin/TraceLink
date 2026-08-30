import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  MapPin,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ConfirmationDialog,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "../../../components";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  buttonStyles,
} from "../../../components/ui";
import { useAuth, useHasPermission } from "../../auth";
import {
  useCancelStaffOrder,
  useStaffOrder,
  useTransitionStaffOrder,
} from "../queries/staff-order-queries";
import {
  canCancelOrder,
  getNextOrderStatus,
} from "../workflow/order-workflow";
import { getOrderStatusMeta } from "../presentation/order-status";
import { formatClp, formatDateTime } from "../../../lib/formatters";

type MutationFeedback =
  | Readonly<{ tone: "success" | "danger"; title: string; description: string }>
  | null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "OcurriÃ³ un error inesperado. Intenta nuevamente.";
}

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const canView = useHasPermission("orders.view");
  const canUpdate = useHasPermission("orders.update");
  const canCancel = useHasPermission("orders.cancel");
  const orderQuery = useStaffOrder(canView ? id : undefined);
  const transitionMutation = useTransitionStaffOrder();
  const cancelMutation = useCancelStaffOrder();
  const [feedback, setFeedback] = useState<MutationFeedback>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

  if (!canView) {
    return (
      <ErrorState
        title="No tienes permiso para ver este pedido"
        description="Solicita el permiso orders.view a una persona administradora."
        action={
          <Link to="/app/orders" className={buttonStyles()}>
            Volver a pedidos
          </Link>
        }
      />
    );
  }

  if (orderQuery.isPending) {
    return (
      <div className="space-y-5" aria-label="Cargando detalle del pedido">
        <LoadingSkeleton className="h-28 rounded-2xl" />
        <LoadingSkeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <ErrorState
        title="No encontramos este pedido"
        description="Verifica el enlace o regresa a la cola operativa."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => void orderQuery.refetch()}>Reintentar</Button>
            <Link
              to="/app/orders"
              className={buttonStyles({ variant: "outline" })}
            >
              Volver a pedidos
            </Link>
          </div>
        }
      />
    );
  }

  const order = orderQuery.data;
  const statusMeta = getOrderStatusMeta(order.status);
  const nextStatus = getNextOrderStatus(order.status);
  const actor =
    session.kind === "staff"
      ? {
          id: session.staff.id,
          name: `${session.staff.firstName} ${session.staff.lastName}`,
        }
      : null;
  const mutationPending =
    transitionMutation.isPending || cancelMutation.isPending;

  const handleTransition = async () => {
    if (!nextStatus || !actor || mutationPending) return;
    setFeedback(null);

    try {
      const updated = await transitionMutation.mutateAsync({
        orderId: order.id,
        toStatus: nextStatus,
        actor,
      });
      setFeedback({
        tone: "success",
        title: "Estado actualizado",
        description: `${updated.orderNumber} avanzÃ³ a ${getOrderStatusMeta(updated.status).label}.`,
      });
    } catch (error: unknown) {
      setFeedback({
        tone: "danger",
        title: "No pudimos actualizar el pedido",
        description: getErrorMessage(error),
      });
    }
  };

  const handleCancel = async () => {
    if (!actor || cancelMutation.isPending) return;
    const normalizedReason = cancelReason.trim();

    if (normalizedReason.length < 5) {
      setCancelReasonError("Escribe un motivo de al menos 5 caracteres.");
      return;
    }

    setCancelReasonError(null);
    setFeedback(null);
    try {
      const updated = await cancelMutation.mutateAsync({
        orderId: order.id,
        reason: normalizedReason,
        actor,
      });
      setCancelDialogOpen(false);
      setCancelReason("");
      setFeedback({
        tone: "success",
        title: "Pedido cancelado",
        description: `La cancelaciÃ³n de ${updated.orderNumber} quedÃ³ registrada en la auditorÃ­a.`,
      });
    } catch (error: unknown) {
      setCancelReasonError(getErrorMessage(error));
    }
  };

  return (
    <div>
      <Link
        to="/app/orders"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-ink-600 hover:text-brand-700"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Cola de pedidos
      </Link>

      <PageHeader
        eyebrow="Pedido operativo"
        title={order.orderNumber}
        description={`Creado el ${formatDateTime(order.createdAt)} Â· Actualizado el ${formatDateTime(order.updatedAt)}`}
        actions={<Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>}
      />

      {feedback ? (
        <Alert
          className="mt-5"
          tone={feedback.tone}
          role={feedback.tone === "success" ? "status" : "alert"}
        >
          {feedback.tone === "success" ? (
            <CheckCircle2 aria-hidden="true" />
          ) : null}
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Flujo del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-ink-600">
                {statusMeta.description} Las acciones disponibles respetan la secuencia
                Pago pendiente â†’ Pagado â†’ En preparaciÃ³n â†’ Listo â†’ Completado.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {nextStatus ? (
                  <Button
                    disabled={!canUpdate || !actor || mutationPending}
                    aria-busy={transitionMutation.isPending}
                    onClick={() => void handleTransition()}
                  >
                    {transitionMutation.isPending
                      ? "Actualizandoâ€¦"
                      : `Avanzar a ${getOrderStatusMeta(nextStatus).label}`}
                  </Button>
                ) : (
                  <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm font-semibold text-ink-700">
                    Este estado no tiene una transiciÃ³n operativa posterior.
                  </p>
                )}
                {canCancelOrder(order.status) ? (
                  <Button
                    variant="danger"
                    disabled={!canCancel || !actor || mutationPending}
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancelar pedido
                  </Button>
                ) : null}
              </div>
              {!canUpdate && nextStatus ? (
                <p className="mt-3 text-sm text-ink-600">
                  Necesitas el permiso orders.update para avanzar el estado.
                </p>
              ) : null}
              {!canCancel && canCancelOrder(order.status) ? (
                <p className="mt-3 text-sm text-ink-600">
                  Necesitas el permiso orders.cancel para cancelar el pedido.
                </p>
              ) : null}
              {order.cancellationReason ? (
                <Alert className="mt-5" tone="warning">
                  <AlertTitle>Motivo de cancelaciÃ³n</AlertTitle>
                  <AlertDescription>{order.cancellationReason}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-ink-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div>
                    <p className="font-bold text-ink-950">{item.name}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      SKU {item.sku} Â· {item.quantity} Ã— {formatClp(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-extrabold text-ink-900">
                    {formatClp(item.lineTotal)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AuditorÃ­a de estados</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0" aria-label="Eventos del pedido">
                {[...order.statusEvents].reverse().map((event, index) => {
                  const eventMeta = getOrderStatusMeta(event.toStatus);
                  return (
                    <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {index < order.statusEvents.length - 1 ? (
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
                          <Badge tone={eventMeta.tone}>{eventMeta.label}</Badge>
                          <time
                            dateTime={event.occurredAt}
                            className="text-xs text-ink-500"
                          >
                            {formatDateTime(event.occurredAt)}
                          </time>
                        </div>
                        <p className="mt-2 text-sm text-ink-700">
                          Registrado por <strong>{event.actorName}</strong>
                          {event.fromStatus
                            ? ` desde ${getOrderStatusMeta(event.fromStatus).label}`
                            : " al crear el pedido"}
                          .
                        </p>
                        {event.reason ? (
                          <p className="mt-1 text-sm text-ink-600">
                            Motivo: {event.reason}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <UserRound aria-hidden="true" className="mt-0.5 size-5 text-brand-700" />
                <div className="min-w-0">
                  <p className="font-bold text-ink-900">{order.customer.fullName}</p>
                  <p className="mt-1 break-all text-ink-600">{order.customer.email}</p>
                  {order.customer.phone ? (
                    <p className="mt-1 text-ink-600">{order.customer.phone}</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 text-ink-600">
                <span>Subtotal</span><span>{formatClp(order.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-ink-600">
                <span>Descuento</span><span>-{formatClp(order.discountTotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-ink-600">
                <span>Entrega</span><span>{formatClp(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-ink-100 pt-4 text-base font-extrabold text-ink-950">
                <span>Total</span><span>{formatClp(order.total)}</span>
              </div>
              <div className="border-t border-ink-100 pt-4 text-ink-600">
                Pago: {order.paymentStatus === "PAID" ? "Pagado" : order.paymentStatus === "REFUNDED" ? "Reembolsado" : "Pendiente"}
              </div>
            </CardContent>
          </Card>

          {order.pickupLocation ? (
            <Card>
              <CardContent className="flex gap-3 pt-5 sm:pt-6">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
                <div>
                  <p className="font-bold text-ink-900">Punto de retiro</p>
                  <p className="mt-1 text-sm text-ink-600">{order.pickupLocation}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <ConfirmationDialog
        open={cancelDialogOpen}
        title={`Cancelar ${order.orderNumber}`}
        description="Esta acciÃ³n detiene el flujo del pedido y quedarÃ¡ registrada con tu identidad."
        confirmLabel="Confirmar cancelaciÃ³n"
        cancelLabel="Conservar pedido"
        pending={cancelMutation.isPending}
        tone="danger"
        onConfirm={() => void handleCancel()}
        onOpenChange={(open) => {
          if (cancelMutation.isPending) return;
          setCancelDialogOpen(open);
          if (!open) {
            setCancelReason("");
            setCancelReasonError(null);
          }
        }}
      >
        <Label htmlFor="order-cancellation-reason">Motivo de cancelaciÃ³n</Label>
        <textarea
          id="order-cancellation-reason"
          rows={4}
          value={cancelReason}
          disabled={cancelMutation.isPending}
          aria-invalid={Boolean(cancelReasonError)}
          aria-describedby={cancelReasonError ? "order-cancellation-error" : undefined}
          className="mt-1.5 w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Ej.: cliente solicitÃ³ anular antes de la preparaciÃ³n"
          onChange={(event) => {
            setCancelReason(event.target.value);
            if (cancelReasonError) setCancelReasonError(null);
          }}
        />
        {cancelReasonError ? (
          <p id="order-cancellation-error" className="mt-2 text-sm font-semibold text-coral-700" role="alert">
            {cancelReasonError}
          </p>
        ) : null}
      </ConfirmationDialog>
    </div>
  );
}
