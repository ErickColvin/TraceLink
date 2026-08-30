import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Settings2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";

import { useSettings, useUpdateSettings } from "../queries/settings-queries";
import { settingsSchema, type SettingsFormValues } from "../settings-schema";

const textAreaClassName = "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:bg-ink-50 aria-[invalid=true]:border-coral-500";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="mt-1.5 text-sm text-coral-700">{message}</p> : null;
}

export function AdminSettingsPage() {
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const [saved, setSaved] = useState(false);
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (!settingsQuery.data) return;
    reset({
      organizationName: settingsQuery.data.organizationName,
      locale: settingsQuery.data.locale,
      currency: settingsQuery.data.currency,
      timezone: settingsQuery.data.timezone,
      contactEmail: settingsQuery.data.contactEmail,
      contactPhone: settingsQuery.data.contactPhone,
      pickupAddress: settingsQuery.data.pickupAddress,
      pickupInstructions: settingsQuery.data.pickupInstructions,
      lowStockThreshold: settingsQuery.data.lowStockThreshold,
      expirationWarningDays: settingsQuery.data.expirationWarningDays,
    });
  }, [reset, settingsQuery.data]);

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    const parsed = settingsSchema.parse(values);
    const updated = await updateSettings.mutateAsync(parsed);
    reset({ ...parsed });
    setSaved(true);
    window.requestAnimationFrame(() => document.getElementById("settings-feedback")?.focus());
    return updated;
  });

  if (settingsQuery.isPending) {
    return <div className="space-y-6"><LoadingSkeleton className="h-24 rounded-2xl" /><LoadingSkeleton className="h-96 rounded-2xl" /></div>;
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return <ErrorState title="No pudimos cargar la configuración" description="Los parámetros operativos no están disponibles." action={<Button onClick={() => void settingsQuery.refetch()}>Reintentar</Button>} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description="Parámetros centrales de organización, contacto, retiro y alertas. Los cambios son mock y se pierden al recargar."
      />

      {saved ? (
        <Alert id="settings-feedback" tabIndex={-1} tone="success" role="status" className="mt-6">
          <Save aria-hidden="true" />
          <p>Configuración guardada en el adapter de demostración.</p>
        </Alert>
      ) : null}
      {updateSettings.isError ? <Alert tone="danger" className="mt-6"><p>No pudimos guardar los cambios. Inténtalo nuevamente.</p></Alert> : null}

      <form className="mt-7 space-y-6" onSubmit={onSubmit} noValidate>
        <Card>
          <CardHeader><CardTitle>Organización y localización</CardTitle></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="settings-organization">Nombre comercial</Label>
              <Input id="settings-organization" disabled={updateSettings.isPending} aria-invalid={Boolean(errors.organizationName)} aria-describedby={errors.organizationName ? "settings-organization-error" : undefined} {...register("organizationName")} />
              <FieldError id="settings-organization-error" message={errors.organizationName?.message} />
            </div>
            <div><Label htmlFor="settings-locale">Locale</Label><Input id="settings-locale" disabled={updateSettings.isPending} aria-invalid={Boolean(errors.locale)} {...register("locale")} /><FieldError id="settings-locale-error" message={errors.locale?.message} /></div>
            <div><Label htmlFor="settings-currency">Moneda ISO</Label><Input id="settings-currency" maxLength={3} disabled={updateSettings.isPending} aria-invalid={Boolean(errors.currency)} {...register("currency")} /><FieldError id="settings-currency-error" message={errors.currency?.message} /></div>
            <div className="md:col-span-2"><Label htmlFor="settings-timezone">Zona horaria</Label><Input id="settings-timezone" disabled={updateSettings.isPending} aria-invalid={Boolean(errors.timezone)} {...register("timezone")} /><FieldError id="settings-timezone-error" message={errors.timezone?.message} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contacto y retiro</CardTitle></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div><Label htmlFor="settings-email">Correo de contacto</Label><Input id="settings-email" type="email" disabled={updateSettings.isPending} aria-invalid={Boolean(errors.contactEmail)} {...register("contactEmail")} /><FieldError id="settings-email-error" message={errors.contactEmail?.message} /></div>
            <div><Label htmlFor="settings-phone">Teléfono de contacto</Label><Input id="settings-phone" type="tel" disabled={updateSettings.isPending} aria-invalid={Boolean(errors.contactPhone)} {...register("contactPhone")} /><FieldError id="settings-phone-error" message={errors.contactPhone?.message} /></div>
            <div className="md:col-span-2"><Label htmlFor="settings-pickup-address">Dirección de retiro</Label><Input id="settings-pickup-address" disabled={updateSettings.isPending} aria-invalid={Boolean(errors.pickupAddress)} {...register("pickupAddress")} /><FieldError id="settings-pickup-address-error" message={errors.pickupAddress?.message} /></div>
            <div className="md:col-span-2"><Label htmlFor="settings-pickup-instructions">Instrucciones de retiro</Label><textarea id="settings-pickup-instructions" rows={4} className={textAreaClassName} disabled={updateSettings.isPending} aria-invalid={Boolean(errors.pickupInstructions)} {...register("pickupInstructions")} /><FieldError id="settings-pickup-instructions-error" message={errors.pickupInstructions?.message} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Umbrales operativos</CardTitle></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div><Label htmlFor="settings-low-stock">Stock bajo general</Label><Input id="settings-low-stock" type="number" min={0} disabled={updateSettings.isPending} aria-invalid={Boolean(errors.lowStockThreshold)} {...register("lowStockThreshold", { valueAsNumber: true })} /><FieldError id="settings-low-stock-error" message={errors.lowStockThreshold?.message} /></div>
            <div><Label htmlFor="settings-expiration">Aviso de vencimiento (días)</Label><Input id="settings-expiration" type="number" min={1} disabled={updateSettings.isPending} aria-invalid={Boolean(errors.expirationWarningDays)} {...register("expirationWarningDays", { valueAsNumber: true })} /><FieldError id="settings-expiration-error" message={errors.expirationWarningDays?.message} /></div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-600">Última actualización: {formatDateTime(settingsQuery.data.updatedAt)}</p>
          <Button type="submit" size="lg" disabled={!isDirty || updateSettings.isPending} aria-busy={updateSettings.isPending}>
            <Settings2 aria-hidden="true" />
            {updateSettings.isPending ? "Guardando…" : "Guardar configuración"}
          </Button>
        </div>
      </form>
    </div>
  );
}
