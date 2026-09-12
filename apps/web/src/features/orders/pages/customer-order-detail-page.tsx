import { ArrowLeft, CreditCard, MapPin, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ConfirmationDialog,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  RequestIdReference,
} from "@/components";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Label, buttonStyles } from "@/components/ui";
import {
  useCancelCurrentCustomerOrder,
  useCurrentCustomerOrder,
  useRetryCurrentCustomerPayment,
} from "@/features/orders";
import { getOrderStatusMeta } from "@/features/orders/presentation/order-status";
import { rememberPendingCheckout } from "@/features/checkout/pending-checkout";
import { formatClp, formatDateTime } from "@/lib/formatters";
import {
  toOperationalError,
  type OperationalError,
} from "@/lib/http/operational-error";
import { PaymentTimeline } from "../components/payment-timeline";

export function CustomerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderQuery = useCurrentCustomerOrder(id);
  const retryPayment = useRetryCurrentCustomerPayment();
  const cancelOrder = useCancelCurrentCustomerOrder();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<OperationalError | null>(null);

  if (orderQuery.isPending) return <div className="space-y-5"><LoadingSkeleton className="h-28 rounded-2xl" /><LoadingSkeleton className="h-72 rounded-2xl" /></div>;
  if (orderQuery.isError || !orderQuery.data) return <ErrorState title="No encontramos este pedido" description="Solo puedes consultar pedidos asociados a tu cuenta." action={<Link to="/mi-cuenta/pedidos" className={buttonStyles()}><ArrowLeft aria-hidden="true" /> Mis pedidos</Link>} />;

  const order = orderQuery.data;
  const meta = getOrderStatusMeta(order.status);
  const payment = order.paymentDetails?.payment;
  const latestAttempt = order.paymentDetails?.attempts.at(-1);
  const canRetry = order.status === "PENDING_PAYMENT";
  const canCancel = order.status === "PENDING_PAYMENT";
  const mutationPending = retryPayment.isPending || cancelOrder.isPending;

  const handleRetry = async () => {
    if (!id || mutationPending) return;
    setFeedback(null);
    setMutationError(null);
    try {
      const result = await retryPayment.mutateAsync(id);
      rememberPendingCheckout(result);
      globalThis.location.assign(result.checkoutUrl);
    } catch (error: unknown) {
      setMutationError(toOperationalError(
        error,
        "No pudimos crear un nuevo intento de pago.",
      ));
    }
  };

  const handleCancel = async () => {
    if (!id || mutationPending) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setMutationError({ message: "Ingresa un motivo de al menos 3 caracteres." });
      return;
    }
    setMutationError(null);
    try {
      await cancelOrder.mutateAsync({ id, reason });
      setCancelOpen(false);
      setCancelReason("");
      setFeedback("Pedido cancelado. La reserva fue liberada si seguia activa.");
      await orderQuery.refetch();
    } catch (error: unknown) {
      setMutationError(toOperationalError(error, "No pudimos cancelar el pedido."));
    }
  };

  return (
    <div>
      <Link to="/mi-cuenta/pedidos" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-ink-600 hover:text-brand-700"><ArrowLeft aria-hidden="true" className="size-4" /> Mis pedidos</Link>
      <PageHeader eyebrow="Detalle de pedido" title={order.orderNumber} description={`Creado el ${formatDateTime(order.createdAt)}`} actions={<Badge tone={meta.tone}>{meta.label}</Badge>} />
      {feedback ? <Alert className="mt-5" tone="success" role="status"><p>{feedback}</p></Alert> : null}
      {mutationError ? <Alert className="mt-5" tone="danger" role="alert"><p>{mutationError.message}</p><RequestIdReference requestId={mutationError.requestId} /></Alert> : null}
      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_320px] xl:items-start">
        <Card>
          <CardHeader><CardTitle>Productos</CardTitle></CardHeader>
          <CardContent className="divide-y divide-ink-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <img
                  src={item.imageUrl ?? "/assets/ch-market-hero.jpg"}
                  alt=""
                  className="size-20 rounded-xl object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/assets/ch-market-hero.jpg";
                  }}
                />
                <div className="min-w-0 flex-1"><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-ink-500">SKU {item.sku} · Cantidad {item.quantity}</p><p className="mt-2 text-sm text-ink-600">{formatClp(item.unitPrice)} c/u</p></div>
                <p className="font-bold">{formatClp(item.lineTotal)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Resumen</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between text-ink-600"><span>Subtotal</span><span>{formatClp(order.subtotal)}</span></div><div className="flex justify-between text-ink-600"><span>Descuento</span><span>-{formatClp(order.discountTotal)}</span></div><div className="flex justify-between text-ink-600"><span>Entrega</span><span>{formatClp(order.deliveryFee)}</span></div><div className="flex justify-between border-t border-ink-100 pt-4 text-base font-extrabold"><span>Total</span><span>{formatClp(order.total)}</span></div></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>Pago</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-ink-600">
              <div className="flex items-center justify-between gap-4">
                <span>Estado</span>
                <Badge tone={payment?.status === "APPROVED" ? "success" : payment?.status === "REFUNDED" ? "neutral" : payment?.status === "REJECTED" || payment?.status === "ERROR" ? "danger" : "warning"}>
                  {payment?.status ?? "PENDIENTE"}
                </Badge>
              </div>
              {latestAttempt?.checkoutUrl && canRetry ? (
                <a className={buttonStyles({ variant: "outline", className: "w-full" })} href={latestAttempt.checkoutUrl}>
                  Volver al pago
                </a>
              ) : null}
              {canRetry ? (
                <Button className="w-full" variant="outline" disabled={mutationPending} onClick={() => void handleRetry()}>
                  <CreditCard aria-hidden="true" /> Nuevo intento
                </Button>
              ) : null}
              {canCancel ? (
                <Button className="w-full" variant="danger" disabled={mutationPending} onClick={() => setCancelOpen(true)}>
                  <XCircle aria-hidden="true" /> Cancelar pedido
                </Button>
              ) : null}
            </CardContent>
          </Card>
          {order.pickupLocation ? <Card><CardContent className="flex gap-3 pt-5 sm:pt-6"><MapPin aria-hidden="true" className="mt-0.5 size-5 text-brand-700" /><div><p className="font-bold">Punto de retiro</p><p className="mt-1 text-sm text-ink-600">{order.pickupLocation}</p></div></CardContent></Card> : null}
        </div>
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Línea de tiempo del pago</CardTitle></CardHeader>
        <CardContent>
          <PaymentTimeline details={order.paymentDetails} />
        </CardContent>
      </Card>
      <ConfirmationDialog
        open={cancelOpen}
        title={`Cancelar ${order.orderNumber}`}
        description="Solo se permite cancelar mientras el pago sigue pendiente. La accion liberara la reserva."
        confirmLabel="Confirmar cancelacion"
        cancelLabel="Mantener pedido"
        pending={cancelOrder.isPending}
        tone="danger"
        onConfirm={() => void handleCancel()}
        onOpenChange={(open) => {
          if (cancelOrder.isPending) return;
          setCancelOpen(open);
          if (!open) setCancelReason("");
        }}
      >
        <Label htmlFor="customer-order-cancel-reason">Motivo</Label>
        <textarea
          id="customer-order-cancel-reason"
          rows={4}
          value={cancelReason}
          disabled={cancelOrder.isPending}
          className="mt-1.5 w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </ConfirmationDialog>
    </div>
  );
}
