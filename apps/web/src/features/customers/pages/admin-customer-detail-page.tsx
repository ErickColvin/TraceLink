import { ArrowLeft, CheckCircle2, Pencil, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ConfirmationDialog,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  buttonStyles,
} from "@/components/ui";
import { useHasPermission } from "@/features/auth";
import { formatDateTime } from "@/lib/formatters";

import { AdminCustomerOverview } from "../components/admin-customer-overview";
import { CustomerForm } from "../components/customer-form";
import type { StaffCustomerUpdateInput } from "../domain";
import {
  customerToFormValues,
  toStaffCustomerUpdateInput,
  type CustomerFormValues,
} from "../schemas/customer-form-schema";
import {
  useStaffCustomer,
  useUpdateStaffCustomer,
} from "../queries/customer-queries";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado. Intenta nuevamente.";
}

export function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const canView = useHasPermission("customers.view");
  const canUpdate = useHasPermission("customers.update");
  const customerQuery = useStaffCustomer(canView ? id : undefined);
  const updateMutation = useUpdateStaffCustomer();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<CustomerFormValues | null>(null);

  if (!canView) {
    return (
      <ErrorState
        title="No tienes permiso para ver este cliente"
        description="Solicita el permiso customers.view a una persona administradora."
        action={
          <Link className={buttonStyles({ variant: "outline" })} to="/app/customers">
            Volver a clientes
          </Link>
        }
      />
    );
  }

  if (customerQuery.isPending) {
    return (
      <div aria-label="Cargando detalle del cliente" className="space-y-5">
        <LoadingSkeleton className="h-28 rounded-2xl" />
        <LoadingSkeleton className="h-52 rounded-2xl" />
        <LoadingSkeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <ErrorState
        title="No encontramos este cliente"
        description="El registro no existe o el directorio no está disponible."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button
              className={buttonStyles()}
              type="button"
              onClick={() => void customerQuery.refetch()}
            >
              Reintentar
            </button>
            <Link className={buttonStyles({ variant: "outline" })} to="/app/customers">
              Volver a clientes
            </Link>
          </div>
        }
      />
    );
  }

  const detail = customerQuery.data;
  const { customer } = detail;

  const save = async (input: StaffCustomerUpdateInput) => {
    if (!canUpdate || updateMutation.isPending) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await updateMutation.mutateAsync({ id: customer.id, input });
      setPendingValues(null);
      setSuccessMessage(
        `Los datos de ${updated.customer.firstName} ${updated.customer.lastName} quedaron actualizados.`,
      );
    } catch (error: unknown) {
      setPendingValues(null);
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleSubmit = async (values: CustomerFormValues) => {
    const input = toStaffCustomerUpdateInput(values);
    if (customer.status === "ACTIVE" && input.status === "INACTIVE") {
      setSuccessMessage(null);
      setErrorMessage(null);
      setPendingValues(values);
      return;
    }
    await save(input);
  };

  const formKey = [
    customer.id,
    customer.firstName,
    customer.lastName,
    customer.email,
    customer.phone,
    customer.status,
    customer.address?.line1,
    customer.address?.line2,
    customer.address?.commune,
    customer.address?.city,
    customer.address?.region,
  ].join("|");

  return (
    <div className="space-y-7">
      <Link
        className={buttonStyles({ size: "sm", variant: "ghost" })}
        to="/app/customers"
      >
        <ArrowLeft aria-hidden="true" /> Volver a clientes
      </Link>

      <PageHeader
        eyebrow="Ficha de cliente"
        title={`${customer.firstName} ${customer.lastName}`}
        description={`Cliente desde ${formatDateTime(customer.createdAt)} · Última actividad ${formatDateTime(detail.lastActivityAt)}`}
        actions={
          <Badge tone={customer.status === "ACTIVE" ? "success" : "danger"}>
            {customer.status === "ACTIVE" ? "Activo" : "Inactivo"}
          </Badge>
        }
      />

      {successMessage ? (
        <Alert aria-live="polite" role="status" tone="success">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Cliente actualizado</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <AdminCustomerOverview detail={detail} />

      <section aria-labelledby="customer-editor-title" className="scroll-mt-24">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
            Gestión autorizada
          </p>
          <h2
            className="mt-2 font-display text-xl font-bold text-ink-950 sm:text-2xl"
            id="customer-editor-title"
          >
            Editar cliente
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600">
            Los cambios se envían al contrato de personal. Esta pantalla nunca utiliza el endpoint de perfil propio del cliente.
          </p>
        </div>

        {canUpdate ? (
          <CustomerForm
            defaultValues={customerToFormValues(customer)}
            errorMessage={errorMessage ?? undefined}
            idPrefix="staff-customer"
            key={formKey}
            pending={updateMutation.isPending}
            showStatus
            submitLabel="Guardar cliente"
            onSubmit={handleSubmit}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pencil aria-hidden="true" className="size-5 text-ink-500" />
                Edición no disponible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert tone="warning">
                <ShieldAlert aria-hidden="true" />
                <p>
                  Puedes consultar la ficha, pero necesitas el permiso customers.update para modificarla.
                </p>
              </Alert>
            </CardContent>
          </Card>
        )}
      </section>

      <ConfirmationDialog
        cancelLabel="Revisar"
        confirmLabel="Desactivar cliente"
        description="El estado quedará inactivo en el servicio de clientes. El backend futuro deberá aplicar esta restricción como límite de seguridad."
        onConfirm={() => {
          if (pendingValues) {
            void save(toStaffCustomerUpdateInput(pendingValues));
          }
        }}
        onOpenChange={(open) => {
          if (!open && !updateMutation.isPending) setPendingValues(null);
        }}
        open={pendingValues !== null}
        pending={updateMutation.isPending}
        title="Desactivar cliente"
        tone="danger"
      />
    </div>
  );
}
