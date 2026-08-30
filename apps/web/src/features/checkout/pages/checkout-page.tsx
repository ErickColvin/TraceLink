import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MapPin, PackageCheck, ShieldAlert, ShoppingBag } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";

import { tenantBrand } from "@/app/config/brand";
import { EmptyState, PageHeader } from "@/components";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  buttonStyles,
} from "@/components/ui";
import { useCart } from "@/features/cart/use-cart";
import { formatClp, formatDateTime } from "@/lib/formatters";

import { checkoutSchema, type CheckoutFormValues } from "../checkout-schema";
import type { CheckoutSubmissionState } from "../domain";
import { checkoutService } from "../services";

const fieldClassName = "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:bg-ink-50 aria-[invalid=true]:border-coral-500";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="mt-1.5 text-sm text-coral-700">{message}</p> : null;
}

export function CheckoutPage() {
  const { clearCart, items, total } = useCart();
  const [submission, setSubmission] = useState<CheckoutSubmissionState>({ kind: "idle" });
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      deliveryMethod: "PICKUP",
      line1: "",
      commune: "",
      city: "Santiago",
      region: "Región Metropolitana",
      notes: "",
    },
  });
  const deliveryMethod = useWatch({ control, name: "deliveryMethod" });
  const pending = submission.kind === "pending";

  const onSubmit = handleSubmit(async (values) => {
    setSubmission({ kind: "pending" });
    try {
      const receipt = await checkoutService.submit({
        contact: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
        },
        deliveryMethod: values.deliveryMethod,
        address: values.deliveryMethod === "DELIVERY"
          ? {
              line1: values.line1,
              commune: values.commune,
              city: values.city,
              region: values.region,
            }
          : undefined,
        notes: values.notes || undefined,
        items,
        total,
      });
      setSubmission({ kind: "success", receipt });
      clearCart();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmission({
        kind: "error",
        message: "No pudimos preparar el pedido de demostración. Inténtalo nuevamente.",
      });
    }
  });

  if (submission.kind === "success") {
    return (
      <div className="bg-ice-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <Card>
            <CardContent className="py-9 text-center sm:py-12">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-100 text-brand-800">
                <CheckCircle2 aria-hidden="true" className="size-8" />
              </span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Simulación completada</p>
              <h1 className="mt-2 font-display text-3xl font-bold">Pedido recibido</h1>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-ink-600">
                Preparamos la confirmación visual <strong>{submission.receipt.orderCode}</strong>. No se realizó ningún cobro ni reserva de stock.
              </p>
              <dl className="mx-auto mt-7 grid max-w-xl gap-3 rounded-2xl bg-ice-50 p-5 text-left sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase tracking-wide text-ink-500">Productos</dt><dd className="mt-1 font-semibold">{submission.receipt.itemCount} unidades</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-ink-500">Total simulado</dt><dd className="mt-1 font-semibold">{formatClp(submission.receipt.total)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-ink-500">Modalidad</dt><dd className="mt-1 font-semibold">{submission.receipt.deliveryMethod === "PICKUP" ? "Retiro" : "Despacho"}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wide text-ink-500">Preparado</dt><dd className="mt-1 font-semibold">{formatDateTime(submission.receipt.receivedAt)}</dd></div>
              </dl>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/productos" className={buttonStyles()}>Seguir comprando</Link>
                <Link to="/login" className={buttonStyles({ variant: "outline" })}>Ir a mi cuenta</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Checkout visual"
          title="Prepara tu pedido"
          description="Completa tus datos y revisa el resumen. Esta experiencia es una simulación: no procesa pagos ni reserva inventario."
        />
        <Alert tone="warning" className="mt-6">
          <ShieldAlert aria-hidden="true" />
          <p><strong>Modo demostración.</strong> No ingreses datos sensibles ni información de pago.</p>
        </Alert>

        {items.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<ShoppingBag />}
            title="No hay productos para confirmar"
            description="Agrega productos al carrito antes de preparar un pedido."
            action={<Link to="/productos" className={buttonStyles()}>Ver productos</Link>}
          />
        ) : (
          <form className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start" onSubmit={onSubmit} noValidate>
            <div className="space-y-6">
              {submission.kind === "error" ? <Alert tone="danger"><p>{submission.message}</p></Alert> : null}
              <Card>
                <CardHeader><CardTitle>Datos de contacto</CardTitle></CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="checkout-first-name">Nombre</Label>
                    <Input id="checkout-first-name" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "checkout-first-name-error" : undefined} disabled={pending} {...register("firstName")} />
                    <FieldError id="checkout-first-name-error" message={errors.firstName?.message} />
                  </div>
                  <div>
                    <Label htmlFor="checkout-last-name">Apellido</Label>
                    <Input id="checkout-last-name" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? "checkout-last-name-error" : undefined} disabled={pending} {...register("lastName")} />
                    <FieldError id="checkout-last-name-error" message={errors.lastName?.message} />
                  </div>
                  <div>
                    <Label htmlFor="checkout-email">Correo</Label>
                    <Input id="checkout-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "checkout-email-error" : undefined} disabled={pending} {...register("email")} />
                    <FieldError id="checkout-email-error" message={errors.email?.message} />
                  </div>
                  <div>
                    <Label htmlFor="checkout-phone">Teléfono</Label>
                    <Input id="checkout-phone" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "checkout-phone-error" : undefined} disabled={pending} {...register("phone")} />
                    <FieldError id="checkout-phone-error" message={errors.phone?.message} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Entrega</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <fieldset disabled={pending}>
                    <legend className="text-sm font-semibold">Modalidad</legend>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-ink-200 p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                        <input type="radio" value="PICKUP" className="mt-1 accent-brand-700" {...register("deliveryMethod")} />
                        <span><strong className="block">Retiro</strong><span className="text-sm text-ink-600">Coordinar en {tenantBrand.serviceArea}.</span></span>
                      </label>
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-ink-200 p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                        <input type="radio" value="DELIVERY" className="mt-1 accent-brand-700" {...register("deliveryMethod")} />
                        <span><strong className="block">Despacho</strong><span className="text-sm text-ink-600">Cobertura y costo se confirmarán después.</span></span>
                      </label>
                    </div>
                  </fieldset>

                  {deliveryMethod === "DELIVERY" ? (
                    <div className="grid gap-5 border-t border-ink-100 pt-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="checkout-address">Dirección</Label>
                        <Input id="checkout-address" autoComplete="street-address" disabled={pending} aria-invalid={Boolean(errors.line1)} aria-describedby={errors.line1 ? "checkout-address-error" : undefined} {...register("line1")} />
                        <FieldError id="checkout-address-error" message={errors.line1?.message} />
                      </div>
                      <div><Label htmlFor="checkout-commune">Comuna</Label><Input id="checkout-commune" disabled={pending} aria-invalid={Boolean(errors.commune)} {...register("commune")} /><FieldError id="checkout-commune-error" message={errors.commune?.message} /></div>
                      <div><Label htmlFor="checkout-city">Ciudad</Label><Input id="checkout-city" disabled={pending} aria-invalid={Boolean(errors.city)} {...register("city")} /><FieldError id="checkout-city-error" message={errors.city?.message} /></div>
                      <div className="sm:col-span-2"><Label htmlFor="checkout-region">Región</Label><Input id="checkout-region" disabled={pending} aria-invalid={Boolean(errors.region)} {...register("region")} /><FieldError id="checkout-region-error" message={errors.region?.message} /></div>
                    </div>
                  ) : (
                    <Alert tone="info"><MapPin aria-hidden="true" /><p>Los datos definitivos de retiro se confirmarán al conectar el backend.</p></Alert>
                  )}

                  <div>
                    <Label htmlFor="checkout-notes">Notas (opcional)</Label>
                    <textarea id="checkout-notes" rows={4} className={fieldClassName} disabled={pending} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? "checkout-notes-error" : undefined} {...register("notes")} />
                    <FieldError id="checkout-notes-error" message={errors.notes?.message} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="lg:sticky lg:top-28">
              <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-3" aria-label="Productos del pedido">
                  {items.map((item) => (
                    <li key={item.productId} className="flex justify-between gap-3 border-b border-ink-100 pb-3 text-sm">
                      <span>{item.quantity} × {item.name}</span>
                      <strong className="shrink-0">{formatClp(item.quantity * item.unitPrice)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center justify-between text-lg"><span className="font-semibold">Total simulado</span><strong>{formatClp(total)}</strong></div>
                <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending} aria-busy={pending}>
                  <PackageCheck aria-hidden="true" />
                  {pending ? "Preparando pedido…" : "Simular pedido"}
                </Button>
                <p className="mt-3 text-center text-xs leading-5 text-ink-500">No se solicitarán datos de tarjeta ni se realizará un cobro.</p>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </div>
  );
}
