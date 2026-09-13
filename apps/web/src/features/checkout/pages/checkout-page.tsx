import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, MapPin, ShieldCheck, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState, PageHeader, RequestIdReference } from "@/components";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  buttonStyles,
} from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useCart } from "@/features/cart/use-cart";
import { formatClp, formatDateTime } from "@/lib/formatters";
import {
  toOperationalError,
  type OperationalError,
} from "@/lib/http/operational-error";

import { checkoutSchema, type CheckoutFormValues } from "../checkout-schema";
import { rememberPendingCheckout } from "../pending-checkout";
import { checkoutService } from "../services";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { clearCart, items, total } = useCart();
  const [error, setError] = useState<OperationalError | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [reservationPreviewAt] = useState(() =>
    formatDateTime(new Date(Date.now() + 15 * 60_000).toISOString()),
  );
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { notes: "" },
  });
  const customerName =
    session.kind === "customer"
      ? `${session.customer.firstName} ${session.customer.lastName}`
      : "";

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setRedirecting(true);
    try {
      const result = await checkoutService.submit({
        contact: {
          firstName: session.kind === "customer" ? session.customer.firstName : "",
          lastName: session.kind === "customer" ? session.customer.lastName : "",
          email: session.kind === "customer" ? session.customer.email : "",
          phone: "",
        },
        deliveryMethod: "PICKUP",
        notes: values.notes || undefined,
        items,
        total,
      });

      clearCart();
      if ("checkoutUrl" in result) {
        rememberPendingCheckout(result);
        globalThis.location.assign(result.checkoutUrl);
        return;
      }
      navigate("/checkout/resultado?status=pending");
    } catch (caught: unknown) {
      setRedirecting(false);
      setError(toOperationalError(
        caught,
        "No pudimos iniciar el pago. Intenta nuevamente.",
      ));
    }
  });

  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Checkout"
          title="Confirmar retiro y pago"
          description="El total se recalcula en servidor, se reserva stock por 15 minutos y el pago se completa en el proveedor."
        />

        {items.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<ShoppingBag />}
            title="No hay productos para pagar"
            description="Agrega productos al carrito antes de iniciar checkout."
            action={<Link to="/productos" className={buttonStyles()}>Ver productos</Link>}
          />
        ) : (
          <form className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start" onSubmit={onSubmit} noValidate>
            <div className="space-y-6">
              {error ? (
                <Alert tone="danger" role="alert">
                  <p>{error.message}</p>
                  <RequestIdReference requestId={error.requestId} />
                </Alert>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Cliente autenticado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-ink-600">
                  <p className="font-semibold text-ink-950">{customerName}</p>
                  {session.kind === "customer" ? (
                    <p className="break-all">{session.customer.email}</p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Retiro en tienda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Alert tone="info">
                    <MapPin aria-hidden="true" />
                    <p>Fase 4 opera solo con retiro. No se aplican despacho, descuentos, impuestos ni montos minimos.</p>
                  </Alert>
                  <div>
                    <Label htmlFor="checkout-notes">Notas para preparacion (opcional)</Label>
                    <textarea
                      id="checkout-notes"
                      rows={4}
                      className="mt-1.5 w-full resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:bg-ink-50 aria-[invalid=true]:border-coral-500"
                      disabled={redirecting}
                      aria-invalid={Boolean(errors.notes)}
                      aria-describedby={errors.notes ? "checkout-notes-error" : undefined}
                      {...register("notes")}
                    />
                    {errors.notes ? (
                      <p id="checkout-notes-error" className="mt-1.5 text-sm text-coral-700">
                        {errors.notes.message}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="lg:sticky lg:top-28">
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3" aria-label="Productos del pedido">
                  {items.map((item) => (
                    <li key={item.productId} className="flex justify-between gap-3 border-b border-ink-100 pb-3 text-sm">
                      <span>{item.quantity} x {item.name}</span>
                      <strong className="shrink-0">{formatClp(item.quantity * item.unitPrice)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center justify-between text-lg">
                  <span className="font-semibold">Total estimado</span>
                  <strong>{formatClp(total)}</strong>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-500">
                  El servidor recalcula precios CLP enteros antes de redirigir.
                  Reserva estimada hasta {reservationPreviewAt}.
                </p>
                <Button type="submit" size="lg" className="mt-6 w-full" disabled={redirecting} aria-busy={redirecting}>
                  <CreditCard aria-hidden="true" />
                  {redirecting ? "Redirigiendo..." : "Pagar pedido"}
                </Button>
                <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-ink-500">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />
                  <span>No se capturan datos de tarjeta en TraceLink.</span>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </div>
  );
}
