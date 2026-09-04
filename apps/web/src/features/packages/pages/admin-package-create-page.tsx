import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "../../../components";
import { Button, buttonStyles } from "../../../components/ui";
import { useAuth, useHasPermission } from "../../auth";
import { PackageReceiptForm } from "../components/package-receipt-form";
import {
  usePackageCustomerOptions,
  useReceiveStaffPackage,
} from "../queries/staff-package-queries";
import type { PackageReceiptValues } from "../schemas/package-receipt-schema";

function toLocalDateTimeInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No pudimos registrar el paquete. Intenta nuevamente.";
}

export function AdminPackageCreatePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const canReceive = useHasPermission("packages.receive");
  const customersQuery = usePackageCustomerOptions({
    page: 1,
    pageSize: 100,
  });
  const receiveMutation = useReceiveStaffPackage();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [defaultReceivedAt] = useState(() =>
    toLocalDateTimeInputValue(new Date()),
  );

  if (!canReceive) {
    return (
      <ErrorState
        title="No tienes permiso para recibir paquetes"
        description="Solicita el permiso packages.receive a una persona administradora."
        action={<Link to="/app/packages" className={buttonStyles()}>Volver a paquetes</Link>}
      />
    );
  }

  const handleSubmit = async (values: PackageReceiptValues) => {
    if (session.kind !== "staff") return;
    setErrorMessage(undefined);
    try {
      const result = await receiveMutation.mutateAsync({
        trackingCode: values.trackingCode,
        carrier: values.carrier,
        customerId: values.customerId,
        orderId: values.orderId || undefined,
        contents: {
          description: values.contentsDescription,
          itemCount: values.itemCount,
          requiresColdStorage: values.requiresColdStorage,
        },
        storageLocation: values.storageLocation,
        notes: values.notes || undefined,
        expectedAt: values.expectedAt
          ? new Date(values.expectedAt).toISOString()
          : undefined,
        receivedAt: new Date(values.receivedAt).toISOString(),
        weightKg: values.weightKg,
        actor: {
          id: session.staff.id,
          name: `${session.staff.firstName} ${session.staff.lastName}`,
        },
      });
      navigate(`/app/packages/${result.id}?received=1`, {
        replace: true,
      });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <div>
      <Link
        to="/app/packages"
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-ink-600 hover:text-brand-700"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Paquetes
      </Link>
      <PageHeader
        eyebrow="Recepción"
        title="Recibir paquete"
        description="Registra el propietario y contenido para iniciar una trazabilidad operativa auditable."
      />

      <div className="mt-6">
        {customersQuery.isPending ? (
          <div className="space-y-4" aria-label="Cargando clientes">
            <LoadingSkeleton className="h-60 rounded-2xl" />
            <LoadingSkeleton className="h-72 rounded-2xl" />
          </div>
        ) : null}
        {customersQuery.isError ? (
          <ErrorState
            title="No pudimos cargar los clientes"
            description="La recepción requiere seleccionar un cliente registrado."
            action={<Button onClick={() => void customersQuery.refetch()}>Reintentar</Button>}
          />
        ) : null}
        {customersQuery.data?.items.length === 0 ? (
          <EmptyState
            title="No hay clientes activos"
            description="Activa o registra un cliente antes de recibir el paquete."
          />
        ) : null}
        {customersQuery.data && customersQuery.data.items.length > 0 ? (
          <PackageReceiptForm
            customers={customersQuery.data.items}
            defaultReceivedAt={defaultReceivedAt}
            errorMessage={errorMessage}
            pending={receiveMutation.isPending}
            onSubmit={handleSubmit}
          />
        ) : null}
      </div>
    </div>
  );
}
