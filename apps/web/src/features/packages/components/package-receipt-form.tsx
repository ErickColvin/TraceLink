import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus, Snowflake } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "../../../components/ui";
import { PACKAGE_CARRIERS, type PackageCustomerOption } from "../domain";
import {
  packageReceiptSchema,
  type PackageReceiptValues,
} from "../schemas/package-receipt-schema";

const selectStyles =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60 aria-[invalid=true]:border-coral-500";

function FieldError({ id, message }: Readonly<{ id: string; message?: string }>) {
  return message ? (
    <p id={id} className="mt-1.5 text-sm font-semibold text-coral-700">
      {message}
    </p>
  ) : null;
}

export type PackageReceiptFormProps = Readonly<{
  customers: readonly PackageCustomerOption[];
  defaultReceivedAt: string;
  errorMessage?: string;
  pending: boolean;
  onSubmit(values: PackageReceiptValues): Promise<void>;
}>;

export function PackageReceiptForm({
  customers,
  defaultReceivedAt,
  errorMessage,
  pending,
  onSubmit,
}: PackageReceiptFormProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<PackageReceiptValues>({
    defaultValues: {
      customerId: "",
      trackingCode: "",
      carrier: "",
      orderId: "",
      contentsDescription: "",
      itemCount: 1,
      requiresColdStorage: false,
      storageLocation: "",
      notes: "",
      expectedAt: "",
      receivedAt: defaultReceivedAt,
      weightKg: undefined,
    },
    resolver: zodResolver(packageReceiptSchema),
  });

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit(onSubmit)}>
      {errorMessage ? (
        <Alert tone="danger" role="alert">
          <p>{errorMessage}</p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identificación y propietario</CardTitle>
          <p className="text-sm text-ink-600">
            El cliente se selecciona desde el registro autorizado; no se acepta un
            nombre escrito libremente.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="package-customer">Cliente</Label>
            <select
              id="package-customer"
              className={selectStyles}
              aria-invalid={Boolean(errors.customerId)}
              aria-describedby={errors.customerId ? "package-customer-error" : undefined}
              {...register("customerId")}
            >
              <option value="">Selecciona un cliente activo</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName} · {customer.email}
                </option>
              ))}
            </select>
            <FieldError id="package-customer-error" message={errors.customerId?.message} />
          </div>
          <div>
            <Label htmlFor="package-tracking-code">Código de seguimiento</Label>
            <Input
              id="package-tracking-code"
              autoComplete="off"
              placeholder="CHM-41090-CL"
              aria-invalid={Boolean(errors.trackingCode)}
              aria-describedby={errors.trackingCode ? "package-tracking-code-error" : undefined}
              {...register("trackingCode")}
            />
            <FieldError id="package-tracking-code-error" message={errors.trackingCode?.message} />
          </div>
          <div>
            <Label htmlFor="package-carrier">Transportista</Label>
            <Input
              id="package-carrier"
              list="package-carrier-options"
              autoComplete="organization"
              placeholder="Ej. Blue Express"
              aria-invalid={Boolean(errors.carrier)}
              aria-describedby={errors.carrier ? "package-carrier-error" : undefined}
              {...register("carrier")}
            />
            <datalist id="package-carrier-options">
              {PACKAGE_CARRIERS.map((carrier) => (
                <option key={carrier} value={carrier} />
              ))}
            </datalist>
            <FieldError id="package-carrier-error" message={errors.carrier?.message} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="package-order-id">Pedido asociado (opcional)</Label>
            <Input
              id="package-order-id"
              autoComplete="off"
              placeholder="order-2026-0850"
              aria-invalid={Boolean(errors.orderId)}
              aria-describedby={errors.orderId ? "package-order-id-error" : undefined}
              {...register("orderId")}
            />
            <FieldError id="package-order-id-error" message={errors.orderId?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contenido declarado</CardTitle></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="package-contents">Descripción del contenido</Label>
            <textarea
              id="package-contents"
              rows={4}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm placeholder:text-ink-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 aria-[invalid=true]:border-coral-500"
              aria-invalid={Boolean(errors.contentsDescription)}
              aria-describedby={errors.contentsDescription ? "package-contents-error" : undefined}
              {...register("contentsDescription")}
            />
            <FieldError id="package-contents-error" message={errors.contentsDescription?.message} />
          </div>
          <div>
            <Label htmlFor="package-item-count">Cantidad de artículos</Label>
            <Input
              id="package-item-count"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              aria-invalid={Boolean(errors.itemCount)}
              aria-describedby={errors.itemCount ? "package-item-count-error" : undefined}
              {...register("itemCount", { valueAsNumber: true })}
            />
            <FieldError id="package-item-count-error" message={errors.itemCount?.message} />
          </div>
          <div>
            <Label htmlFor="package-weight">Peso en kg (opcional)</Label>
            <Input
              id="package-weight"
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              aria-invalid={Boolean(errors.weightKg)}
              aria-describedby={errors.weightKg ? "package-weight-error" : undefined}
              {...register("weightKg", {
                setValueAs: (value: unknown) =>
                  value === "" || value === undefined ? undefined : Number(value),
              })}
            />
            <FieldError id="package-weight-error" message={errors.weightKg?.message} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 p-4 md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand-700"
              {...register("requiresColdStorage")}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                <Snowflake aria-hidden="true" className="size-4 text-brand-700" />
                Requiere cadena de frío
              </span>
              <span className="mt-1 block text-xs text-ink-600">
                Permite priorizar su almacenamiento en una ubicación refrigerada.
              </span>
            </span>
          </label>
          <div className="md:col-span-2">
            <Label htmlFor="package-storage-location">Ubicación inicial</Label>
            <Input
              id="package-storage-location"
              placeholder="Ej. Cámara fría · Módulo F-07"
              aria-invalid={Boolean(errors.storageLocation)}
              aria-describedby={errors.storageLocation ? "package-storage-location-error" : undefined}
              {...register("storageLocation")}
            />
            <FieldError
              id="package-storage-location-error"
              message={errors.storageLocation?.message}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="package-notes">Notas operativas (opcional)</Label>
            <textarea
              id="package-notes"
              rows={3}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm placeholder:text-ink-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 aria-[invalid=true]:border-coral-500"
              placeholder="Observaciones de embalaje, temperatura o manipulación."
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "package-notes-error" : undefined}
              {...register("notes")}
            />
            <FieldError id="package-notes-error" message={errors.notes?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Fechas operativas</CardTitle></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="package-expected-at">Fecha esperada (opcional)</Label>
            <Input
              id="package-expected-at"
              type="datetime-local"
              aria-invalid={Boolean(errors.expectedAt)}
              aria-describedby={errors.expectedAt ? "package-expected-at-error" : undefined}
              {...register("expectedAt")}
            />
            <FieldError id="package-expected-at-error" message={errors.expectedAt?.message} />
          </div>
          <div>
            <Label htmlFor="package-received-at">Fecha de recepción</Label>
            <Input
              id="package-received-at"
              type="datetime-local"
              aria-invalid={Boolean(errors.receivedAt)}
              aria-describedby={errors.receivedAt ? "package-received-at-error" : undefined}
              {...register("receivedAt")}
            />
            <FieldError id="package-received-at-error" message={errors.receivedAt?.message} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          <PackagePlus aria-hidden="true" />
          {pending ? "Registrando…" : "Registrar recepción"}
        </Button>
      </div>
    </form>
  );
}
