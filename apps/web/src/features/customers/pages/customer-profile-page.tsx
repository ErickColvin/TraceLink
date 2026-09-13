import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import {
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from "@/components/ui";

import { CustomerForm } from "../components/customer-form";
import {
  useCurrentCustomer,
  useUpdateCurrentCustomer,
} from "../queries/customer-queries";
import {
  customerToFormValues,
  toCustomerProfileInput,
  type CustomerFormValues,
} from "../schemas/customer-form-schema";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado. Intenta nuevamente.";
}

export function CustomerProfilePage() {
  const customerQuery = useCurrentCustomer();
  const updateMutation = useUpdateCurrentCustomer();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (customerQuery.isPending) {
    return (
      <div aria-label="Cargando perfil" className="space-y-5">
        <LoadingSkeleton className="h-28 rounded-2xl" />
        <LoadingSkeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <ErrorState
        title="No pudimos cargar tu perfil"
        description="Tu identidad sigue protegida. Reintenta para consultar nuevamente tus datos."
        action={<Button onClick={() => void customerQuery.refetch()}>Reintentar</Button>}
      />
    );
  }

  const customer = customerQuery.data;

  const handleSubmit = async (values: CustomerFormValues) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    updateMutation.reset();

    try {
      const updated = await updateMutation.mutateAsync(
        toCustomerProfileInput(values),
      );
      setSuccessMessage(`Tus datos quedaron guardados, ${updated.firstName}.`);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const formKey = [
    customer.id,
    customer.firstName,
    customer.lastName,
    customer.email,
    customer.phone,
    customer.address?.line1,
    customer.address?.line2,
    customer.address?.commune,
    customer.address?.city,
    customer.address?.region,
  ].join("|");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Mi perfil"
        description="Revisa y actualiza los datos asociados a tu identidad autenticada."
      />

      <Alert tone="info">
        <ShieldCheck aria-hidden="true" />
        <AlertTitle>Tu identidad define este perfil</AlertTitle>
        <AlertDescription>
          Esta pantalla no acepta un identificador ni permite buscar a otras personas. En esta demo, los cambios viven solo en memoria y se reinician al recargar.
        </AlertDescription>
      </Alert>

      {successMessage ? (
        <Alert aria-live="polite" role="status" tone="success">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Perfil actualizado</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <CustomerForm
        defaultValues={customerToFormValues(customer)}
        errorMessage={errorMessage ?? undefined}
        idPrefix="customer-profile"
        key={formKey}
        pending={updateMutation.isPending}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
