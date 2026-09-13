import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Save, UserRound } from "lucide-react";
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
} from "@/components/ui";

import {
  customerFormSchema,
  type CustomerFormValues,
} from "../schemas/customer-form-schema";

const selectClassName =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60 aria-[invalid=true]:border-coral-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-coral-100";

export type CustomerFormProps = Readonly<{
  defaultValues: CustomerFormValues;
  errorMessage?: string;
  idPrefix: string;
  pending: boolean;
  showStatus?: boolean;
  submitLabel?: string;
  onSubmit(values: CustomerFormValues): Promise<void>;
}>;

function FieldError({ id, message }: Readonly<{ id: string; message?: string }>) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-sm text-coral-700" id={id}>
      {message}
    </p>
  );
}

export function CustomerForm({
  defaultValues,
  errorMessage,
  idPrefix,
  pending,
  showStatus = false,
  submitLabel = "Guardar cambios",
  onSubmit,
}: CustomerFormProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CustomerFormValues>({
    defaultValues,
    resolver: zodResolver(customerFormSchema),
  });
  const fieldId = (field: string) => `${idPrefix}-${field}`;

  return (
    <form
      aria-busy={pending}
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      {errorMessage ? (
        <Alert tone="danger">
          <p>{errorMessage}</p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound aria-hidden="true" className="size-5 text-brand-700" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor={fieldId("first-name")}>Nombre</Label>
            <Input
              id={fieldId("first-name")}
              autoComplete="given-name"
              disabled={pending}
              aria-describedby={errors.firstName ? fieldId("first-name-error") : undefined}
              aria-invalid={Boolean(errors.firstName)}
              {...register("firstName")}
            />
            <FieldError id={fieldId("first-name-error")} message={errors.firstName?.message} />
          </div>
          <div>
            <Label htmlFor={fieldId("last-name")}>Apellido</Label>
            <Input
              id={fieldId("last-name")}
              autoComplete="family-name"
              disabled={pending}
              aria-describedby={errors.lastName ? fieldId("last-name-error") : undefined}
              aria-invalid={Boolean(errors.lastName)}
              {...register("lastName")}
            />
            <FieldError id={fieldId("last-name-error")} message={errors.lastName?.message} />
          </div>
          <div>
            <Label htmlFor={fieldId("email")}>Correo electrónico</Label>
            <Input
              id={fieldId("email")}
              autoComplete="email"
              disabled={pending}
              type="email"
              aria-describedby={errors.email ? fieldId("email-error") : undefined}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            <FieldError id={fieldId("email-error")} message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor={fieldId("phone")}>Teléfono</Label>
            <Input
              id={fieldId("phone")}
              autoComplete="tel"
              disabled={pending}
              type="tel"
              aria-describedby={errors.phone ? fieldId("phone-error") : undefined}
              aria-invalid={Boolean(errors.phone)}
              {...register("phone")}
            />
            <FieldError id={fieldId("phone-error")} message={errors.phone?.message} />
          </div>
          {showStatus ? (
            <div className="sm:col-span-2 sm:max-w-sm">
              <Label htmlFor={fieldId("status")}>Estado</Label>
              <select
                className={selectClassName}
                disabled={pending}
                id={fieldId("status")}
                {...register("status")}
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
              <p className="mt-1.5 text-xs text-ink-500">
                Desactivar registra una restricción de acceso y requiere confirmación.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-5 text-brand-700" />
            Dirección
          </CardTitle>
          <p className="text-sm text-ink-600">
            Puedes dejar todos estos campos vacíos. Si agregas una dirección,
            completa calle, comuna, ciudad y región.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("address-line-1")}>Calle y número</Label>
            <Input
              id={fieldId("address-line-1")}
              autoComplete="address-line1"
              disabled={pending}
              aria-describedby={errors.addressLine1 ? fieldId("address-line-1-error") : undefined}
              aria-invalid={Boolean(errors.addressLine1)}
              {...register("addressLine1")}
            />
            <FieldError id={fieldId("address-line-1-error")} message={errors.addressLine1?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("address-line-2")}>Departamento u otra referencia</Label>
            <Input
              id={fieldId("address-line-2")}
              autoComplete="address-line2"
              disabled={pending}
              {...register("addressLine2")}
            />
          </div>
          <div>
            <Label htmlFor={fieldId("commune")}>Comuna</Label>
            <Input
              id={fieldId("commune")}
              autoComplete="address-level3"
              disabled={pending}
              aria-describedby={errors.commune ? fieldId("commune-error") : undefined}
              aria-invalid={Boolean(errors.commune)}
              {...register("commune")}
            />
            <FieldError id={fieldId("commune-error")} message={errors.commune?.message} />
          </div>
          <div>
            <Label htmlFor={fieldId("city")}>Ciudad</Label>
            <Input
              id={fieldId("city")}
              autoComplete="address-level2"
              disabled={pending}
              aria-describedby={errors.city ? fieldId("city-error") : undefined}
              aria-invalid={Boolean(errors.city)}
              {...register("city")}
            />
            <FieldError id={fieldId("city-error")} message={errors.city?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("region")}>Región</Label>
            <Input
              id={fieldId("region")}
              autoComplete="address-level1"
              disabled={pending}
              aria-describedby={errors.region ? fieldId("region-error") : undefined}
              aria-invalid={Boolean(errors.region)}
              {...register("region")}
            />
            <FieldError id={fieldId("region-error")} message={errors.region?.message} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={pending} size="lg" type="submit">
          <Save aria-hidden="true" />
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
