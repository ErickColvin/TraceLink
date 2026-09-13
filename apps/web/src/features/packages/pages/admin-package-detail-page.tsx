import {
  ArrowLeft,
  Box,
  CheckCircle2,
  MapPin,
  Snowflake,
  Truck,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

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
  Input,
  Label,
  buttonStyles,
} from "../../../components/ui";
import { useAuth, useHasPermission } from "../../auth";
import { TrackingTimeline } from "../components/tracking-timeline";
import type { PackageStatus } from "../domain";
import { getPackageStatusMeta } from "../presentation/package-status";
import { getPackageStorageDuration } from "../presentation/package-storage-duration";
import {
  useDeliverStaffPackage,
  useStaffPackage,
  useTransitionStaffPackage,
} from "../queries/staff-package-queries";
import {
  getAllowedPackageTransitions,
  getNextStandardPackageStatus,
} from "../workflow/package-workflow";
import { formatDateTime } from "../../../lib/formatters";

type MutationFeedback =
  | Readonly<{ tone: "success" | "danger"; title: string; description: string }>
  | null;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocurrió un error inesperado. Intenta nuevamente.";
}

function readAllowedStatus(
  value: string,
  allowed: readonly PackageStatus[],
): PackageStatus | "" {
  return allowed.find((status) => status === value) ?? "";
}

export function AdminPackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const canView = useHasPermission("packages.view");
  const canUpdate = useHasPermission("packages.update");
  const canDeliver = useHasPermission("packages.deliver");
  const packageQuery = useStaffPackage(canView ? id : undefined);
  const transitionMutation = useTransitionStaffPackage();
  const deliverMutation = useDeliverStaffPackage();
  const [feedback, setFeedback] = useState<MutationFeedback>(() =>
    searchParams.get("received") === "1"
      ? {
          tone: "success",
          title: "Recepción registrada",
          description: "El paquete fue vinculado al cliente y su trazabilidad ya está activa.",
        }
      : null,
  );
  const [storageLocation, setStorageLocation] = useState("");
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionStatus, setExceptionStatus] = useState<PackageStatus | "">("");
  const [exceptionDescription, setExceptionDescription] = useState("");
  const [exceptionLocation, setExceptionLocation] = useState("");
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [pickupCode, setPickupCode] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  if (!canView) {
    return (
      <ErrorState
        title="No tienes permiso para ver este paquete"
        description="Solicita el permiso packages.view a una persona administradora."
        action={<Link to="/app/packages" className={buttonStyles()}>Volver a paquetes</Link>}
      />
    );
  }

  if (packageQuery.isPending) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]" aria-label="Cargando paquete">
        <LoadingSkeleton className="h-[620px] rounded-2xl" />
        <LoadingSkeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (packageQuery.isError || !packageQuery.data) {
    return (
      <ErrorState
        title="No encontramos este paquete"
        description="Verifica el enlace o regresa a la cola operativa."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => void packageQuery.refetch()}>Reintentar</Button>
            <Link to="/app/packages" className={buttonStyles({ variant: "outline" })}>
              Volver a paquetes
            </Link>
          </div>
        }
      />
    );
  }

  const item = packageQuery.data;
  const meta = getPackageStatusMeta(item.status);
  const storageDuration = getPackageStorageDuration(item);
  const nextStandard = getNextStandardPackageStatus(item.status);
  const allowedTransitions = getAllowedPackageTransitions(item.status);
  const alternativeTransitions = allowedTransitions.filter(
    (status) => status !== nextStandard && status !== "PICKED_UP",
  );
  const actor =
    session.kind === "staff"
      ? {
          id: session.staff.id,
          name: `${session.staff.firstName} ${session.staff.lastName}`,
        }
      : null;
  const mutationPending = transitionMutation.isPending || deliverMutation.isPending;

  const handleStandardTransition = async () => {
    if (!nextStandard || nextStandard === "PICKED_UP" || !actor || mutationPending) {
      return;
    }
    if (nextStandard === "STORED" && storageLocation.trim().length < 2) {
      setFeedback({
        tone: "danger",
        title: "Falta la ubicación",
        description: "Indica la ubicación donde quedará almacenado el paquete.",
      });
      return;
    }
    setFeedback(null);
    try {
      const updated = await transitionMutation.mutateAsync({
        packageId: item.id,
        toStatus: nextStandard,
        location: nextStandard === "STORED" ? storageLocation : undefined,
        actor,
      });
      setStorageLocation("");
      setFeedback({
        tone: "success",
        title: "Estado actualizado",
        description: `${updated.trackingCode} avanzó a ${getPackageStatusMeta(updated.status).label}.`,
      });
    } catch (error: unknown) {
      setFeedback({
        tone: "danger",
        title: "No pudimos actualizar el paquete",
        description: getErrorMessage(error),
      });
    }
  };

  const handleExceptionalTransition = async () => {
    if (!exceptionStatus || !actor || transitionMutation.isPending) return;
    if (exceptionDescription.trim().length < 5) {
      setExceptionError("Describe el motivo con al menos 5 caracteres.");
      return;
    }
    if (exceptionStatus === "STORED" && exceptionLocation.trim().length < 2) {
      setExceptionError("Indica la ubicación de almacenamiento.");
      return;
    }
    setExceptionError(null);
    try {
      const updated = await transitionMutation.mutateAsync({
        packageId: item.id,
        toStatus: exceptionStatus,
        description: exceptionDescription,
        location: exceptionLocation || undefined,
        actor,
      });
      setExceptionDialogOpen(false);
      setExceptionStatus("");
      setExceptionDescription("");
      setExceptionLocation("");
      setFeedback({
        tone: "success",
        title: "Evento excepcional registrado",
        description: `${updated.trackingCode} quedó en ${getPackageStatusMeta(updated.status).label}.`,
      });
    } catch (error: unknown) {
      setExceptionError(getErrorMessage(error));
    }
  };

  const handleDelivery = async () => {
    if (!actor || deliverMutation.isPending) return;
    if (pickupCode.trim().length < 4) {
      setDeliveryError("Ingresa un código de retiro de al menos 4 caracteres.");
      return;
    }
    if (receivedBy.trim().length < 3) {
      setDeliveryError("Ingresa el nombre de quien recibe.");
      return;
    }
    setDeliveryError(null);
    try {
      const updated = await deliverMutation.mutateAsync({
        packageId: item.id,
        pickupCode,
        receivedBy,
        actor,
      });
      setDeliveryDialogOpen(false);
      setPickupCode("");
      setReceivedBy("");
      setFeedback({
        tone: "success",
        title: "Entrega confirmada",
        description: `${updated.trackingCode} quedó marcado como retirado y auditado.`,
      });
    } catch (error: unknown) {
      setDeliveryError(getErrorMessage(error));
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
        eyebrow="Paquete operativo"
        title={item.trackingCode}
        description={`${item.customer.fullName} · Actualizado el ${formatDateTime(item.updatedAt)}`}
        actions={<Badge tone={meta.tone}>{meta.label}</Badge>}
      />

      {feedback ? (
        <Alert className="mt-5" tone={feedback.tone} role={feedback.tone === "success" ? "status" : "alert"}>
          {feedback.tone === "success" ? <CheckCircle2 aria-hidden="true" /> : null}
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Acciones operativas</CardTitle>
              <p className="text-sm text-ink-600">
                Solo se habilitan transiciones válidas desde el estado actual.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {nextStandard === "STORED" ? (
                <div className="max-w-xl">
                  <Label htmlFor="package-storage-location">Ubicación de almacenamiento</Label>
                  <Input
                    id="package-storage-location"
                    value={storageLocation}
                    placeholder={item.contents.requiresColdStorage ? "Cámara fría · Módulo F-08" : "Bodega seca · Estante C-04"}
                    disabled={!canUpdate || mutationPending}
                    onChange={(event) => setStorageLocation(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {nextStandard && nextStandard !== "PICKED_UP" ? (
                  <Button
                    disabled={!canUpdate || !actor || mutationPending}
                    aria-busy={transitionMutation.isPending}
                    onClick={() => void handleStandardTransition()}
                  >
                    {transitionMutation.isPending
                      ? "Actualizando…"
                      : `Marcar como ${getPackageStatusMeta(nextStandard).shortLabel}`}
                  </Button>
                ) : null}
                {nextStandard === "PICKED_UP" ? (
                  <Button
                    disabled={!canDeliver || !actor || mutationPending}
                    onClick={() => setDeliveryDialogOpen(true)}
                  >
                    Confirmar entrega
                  </Button>
                ) : null}
                {alternativeTransitions.length > 0 ? (
                  <Button
                    variant="danger"
                    disabled={!canUpdate || !actor || mutationPending}
                    onClick={() => setExceptionDialogOpen(true)}
                  >
                    Registrar excepción o resolución
                  </Button>
                ) : null}
                {!nextStandard && alternativeTransitions.length === 0 ? (
                  <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm font-semibold text-ink-700">
                    Este paquete se encuentra en un estado terminal.
                  </p>
                ) : null}
              </div>
              {nextStandard && nextStandard !== "PICKED_UP" && !canUpdate ? (
                <p className="text-sm text-ink-600">Necesitas packages.update para avanzar el estado.</p>
              ) : null}
              {nextStandard === "PICKED_UP" && !canDeliver ? (
                <p className="text-sm text-ink-600">Necesitas packages.deliver para confirmar la entrega.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recorrido del paquete</CardTitle>
              <p className="text-sm text-ink-600">Cada cambio queda representado como un evento de trazabilidad.</p>
            </CardHeader>
            <CardContent>
              <TrackingTimeline currentStatus={item.status} events={item.events} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24">
          <Card>
            <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <UserRound aria-hidden="true" className="mt-0.5 size-5 text-brand-700" />
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-ink-900">{item.customer.fullName}</p>
                  <p className="mt-1 break-all text-ink-600">{item.customer.email}</p>
                  {item.customer.phone ? <p className="mt-1 text-ink-600">{item.customer.phone}</p> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Información</CardTitle></CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="flex gap-3">
                <Truck aria-hidden="true" className="mt-0.5 size-4 text-brand-700" />
                <div><p className="font-semibold">Carrier</p><p className="mt-1 text-ink-600">{item.carrier}</p></div>
              </div>
              <div className="flex gap-3">
                <Box aria-hidden="true" className="mt-0.5 size-4 text-brand-700" />
                <div><p className="font-semibold">Contenido</p><p className="mt-1 text-ink-600">{item.contents.description} · {item.contents.itemCount} artículos</p></div>
              </div>
              {item.contents.requiresColdStorage ? (
                <div className="flex gap-3">
                  <Snowflake aria-hidden="true" className="mt-0.5 size-4 text-brand-700" />
                  <div><p className="font-semibold">Cadena de frío</p><p className="mt-1 text-ink-600">Requiere almacenamiento refrigerado.</p></div>
                </div>
              ) : null}
              {item.storageLocation ? (
                <div className="flex gap-3">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 text-brand-700" />
                  <div><p className="font-semibold">Ubicación</p><p className="mt-1 text-ink-600">{item.storageLocation}</p></div>
                </div>
              ) : null}
              {item.receivedAt ? <p className="text-ink-600">Recibido: {formatDateTime(item.receivedAt)}</p> : null}
              {storageDuration ? (
                <p className="text-ink-600">
                  Tiempo almacenado: {storageDuration.days > 0 ? `${storageDuration.days} días` : `${storageDuration.hours} horas`}
                </p>
              ) : null}
              {item.pickupDeadline ? <p className="text-ink-600">Retirar antes de: {formatDateTime(item.pickupDeadline)}</p> : null}
              {item.orderId ? <p className="text-ink-600">Pedido asociado: {item.orderId}</p> : null}
              <p className="text-ink-600">Notas: {item.notes ?? "Sin notas operativas"}</p>
            </CardContent>
          </Card>

          {item.pickupReceipt ? (
            <Card>
              <CardHeader><CardTitle>Comprobante de entrega</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-ink-600">
                <p><strong className="text-ink-900">Recibió:</strong> {item.pickupReceipt.receivedBy}</p>
                <p><strong className="text-ink-900">Entregó:</strong> {item.pickupReceipt.deliveredBy}</p>
                <p><strong className="text-ink-900">Fecha:</strong> {formatDateTime(item.pickupReceipt.deliveredAt)}</p>
                <p><strong className="text-ink-900">Código:</strong> verificado, no almacenado</p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      <ConfirmationDialog
        open={deliveryDialogOpen}
        title={`Entregar ${item.trackingCode}`}
        description="Verifica el código y registra a quien recibe. El código no se conservará en el historial."
        confirmLabel="Confirmar entrega"
        cancelLabel="Volver"
        pending={deliverMutation.isPending}
        tone="primary"
        onConfirm={() => void handleDelivery()}
        onOpenChange={(open) => {
          if (deliverMutation.isPending) return;
          setDeliveryDialogOpen(open);
          if (!open) {
            setPickupCode("");
            setReceivedBy("");
            setDeliveryError(null);
          }
        }}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="package-pickup-code">Código de retiro</Label>
            <Input
              id="package-pickup-code"
              type="password"
              autoComplete="one-time-code"
              value={pickupCode}
              disabled={deliverMutation.isPending}
              aria-invalid={Boolean(deliveryError && pickupCode.trim().length < 4)}
              onChange={(event) => {
                setPickupCode(event.target.value);
                if (deliveryError) setDeliveryError(null);
              }}
            />
          </div>
          <div>
            <Label htmlFor="package-received-by">Nombre de quien recibe</Label>
            <Input
              id="package-received-by"
              value={receivedBy}
              disabled={deliverMutation.isPending}
              aria-invalid={Boolean(deliveryError && receivedBy.trim().length < 3)}
              onChange={(event) => {
                setReceivedBy(event.target.value);
                if (deliveryError) setDeliveryError(null);
              }}
            />
          </div>
          {deliveryError ? <p className="text-sm font-semibold text-coral-700" role="alert">{deliveryError}</p> : null}
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={exceptionDialogOpen}
        title={`Cambiar estado de ${item.trackingCode}`}
        description="Las excepciones y resoluciones quedan registradas de forma permanente en la trazabilidad."
        confirmLabel="Registrar evento"
        cancelLabel="Volver"
        pending={transitionMutation.isPending}
        tone="danger"
        onConfirm={() => void handleExceptionalTransition()}
        onOpenChange={(open) => {
          if (transitionMutation.isPending) return;
          setExceptionDialogOpen(open);
          if (!open) {
            setExceptionStatus("");
            setExceptionDescription("");
            setExceptionLocation("");
            setExceptionError(null);
          }
        }}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="package-exception-status">Nuevo estado</Label>
            <select
              id="package-exception-status"
              value={exceptionStatus}
              className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              onChange={(event) => {
                setExceptionStatus(readAllowedStatus(event.target.value, alternativeTransitions));
                setExceptionError(null);
              }}
            >
              <option value="">Selecciona un estado</option>
              {alternativeTransitions.map((status) => (
                <option key={status} value={status}>{getPackageStatusMeta(status).label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="package-exception-description">Motivo o resolución</Label>
            <textarea
              id="package-exception-description"
              rows={4}
              value={exceptionDescription}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              onChange={(event) => {
                setExceptionDescription(event.target.value);
                setExceptionError(null);
              }}
            />
          </div>
          {exceptionStatus === "STORED" ? (
            <div>
              <Label htmlFor="package-resolution-location">Ubicación</Label>
              <Input id="package-resolution-location" value={exceptionLocation} onChange={(event) => setExceptionLocation(event.target.value)} />
            </div>
          ) : null}
          {exceptionError ? <p className="text-sm font-semibold text-coral-700" role="alert">{exceptionError}</p> : null}
        </div>
      </ConfirmationDialog>
    </div>
  );
}
