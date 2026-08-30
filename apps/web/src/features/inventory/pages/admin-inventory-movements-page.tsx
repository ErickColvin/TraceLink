import { ArrowLeft, ArrowRightLeft, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components";
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
} from "@/components/ui";
import { buttonStyles } from "@/components/ui/button-styles";

import { InventoryMovementForm } from "../components/inventory-movement-form";
import { InventoryMovementPreviewCard } from "../components/inventory-movement-preview";
import { InventoryMovementResults } from "../components/inventory-movement-results";
import { InventoryPagination } from "../components/inventory-pagination";
import {
  INVENTORY_MOVEMENT_TYPES,
  type CreateInventoryMovementInput,
  type InventoryMovementPreview,
  type InventoryMovementType,
} from "../domain";
import { inventoryMovementTypeLabels } from "../presentation/inventory-presentation";
import {
  useCreateInventoryMovement,
  useInventory,
  useInventoryMovements,
} from "../queries/inventory-queries";
import { previewInventoryMovement } from "../rules/inventory-movement-rules";
import type { InventoryMovementFormValues } from "../schemas/inventory-movement-schema";

const SELECT_STYLES =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm hover:border-ink-300 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60";

function isMovementType(value: string): value is InventoryMovementType {
  return INVENTORY_MOVEMENT_TYPES.some((type) => type === value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "No pudimos registrar el movimiento. Intenta nuevamente.";
}

export function AdminInventoryMovementsPage() {
  const [search, setSearch] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [movementType, setMovementType] = useState<InventoryMovementType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [candidate, setCandidate] = useState<CreateInventoryMovementInput>();
  const [preview, setPreview] = useState<InventoryMovementPreview>();
  const [previewError, setPreviewError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const inventoryQuery = useInventory({
    sort: "PRODUCT_ASC",
    pageSize: 200,
  });
  const movementQuery = useInventoryMovements({
    search: search || undefined,
    inventoryItemId: inventoryItemId || undefined,
    types: movementType ? [movementType] : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 6,
  });
  const createMovement = useCreateInventoryMovement();
  const inventoryItems = inventoryQuery.data?.items ?? [];
  const candidateItem = candidate
    ? inventoryItems.find((item) => item.id === candidate.inventoryItemId)
    : undefined;

  function prepareMovement(values: InventoryMovementFormValues) {
    setSuccessMessage(undefined);
    createMovement.reset();
    const item = inventoryItems.find(
      (inventoryItem) => inventoryItem.id === values.inventoryItemId,
    );

    if (!item) {
      setPreviewError("Selecciona un registro de inventario disponible.");
      return;
    }

    const input: CreateInventoryMovementInput = {
      ...values,
      reason: values.reason?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    try {
      const nextPreview = previewInventoryMovement(item, input);
      setCandidate(input);
      setPreview(nextPreview);
      setPreviewError(undefined);
      setConfirmationOpen(true);
    } catch (error) {
      setPreviewError(getErrorMessage(error));
    }
  }

  async function confirmMovement() {
    if (!candidate) return;

    try {
      const movement = await createMovement.mutateAsync(candidate);
      setSuccessMessage(
        `${inventoryMovementTypeLabels[movement.type]} registrado para ${movement.productName}.`,
      );
      setConfirmationOpen(false);
      setCandidate(undefined);
      setPreview(undefined);
    } catch {
      setConfirmationOpen(false);
    }
  }

  function updateMovementType(value: string) {
    setMovementType(isMovementType(value) ? value : "");
    setPage(1);
  }

  const hasHistoryFilters = Boolean(
    search || inventoryItemId || movementType || dateFrom || dateTo,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className={buttonStyles({ variant: "outline" })}
            to="/app/inventory"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver al inventario
          </Link>
        }
        description="Registra entradas y salidas con motivo, confirmación y trazabilidad antes/después."
        eyebrow="Operación"
        title="Movimientos de inventario"
      />

      <Alert tone="info">
        <ArrowRightLeft aria-hidden="true" />
        <AlertTitle>El stock no se edita directamente</AlertTitle>
        <AlertDescription>
          Cada cambio crea un movimiento auditable. Esta operación es una simulación frontend y deberá ser validada por el backend futuro.
        </AlertDescription>
      </Alert>

      {successMessage ? (
        <Alert role="status" tone="success">
          <AlertTitle>Movimiento registrado</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {previewError ? (
        <Alert tone="danger">
          <AlertTitle>Revisa el movimiento</AlertTitle>
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      ) : null}
      {createMovement.isError ? (
        <Alert tone="danger">
          <AlertTitle>No pudimos registrar el movimiento</AlertTitle>
          <AlertDescription>
            {getErrorMessage(createMovement.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nuevo movimiento</CardTitle>
            <p className="text-sm leading-relaxed text-ink-600">
              Primero revisaremos el impacto y luego pediremos confirmación explícita.
            </p>
          </CardHeader>
          <CardContent>
            {inventoryQuery.isPending ? (
              <div className="space-y-4" aria-label="Cargando formulario de movimiento">
                <LoadingSkeleton className="h-11" />
                <LoadingSkeleton className="h-11" />
                <LoadingSkeleton className="h-28" />
              </div>
            ) : inventoryQuery.isError || !inventoryQuery.data ? (
              <ErrorState
                action={
                  <Button onClick={() => void inventoryQuery.refetch()}>
                    Reintentar
                  </Button>
                }
                description="Necesitamos los registros vigentes para calcular un movimiento seguro."
                title="No pudimos cargar el inventario"
              />
            ) : inventoryItems.length === 0 ? (
              <EmptyState
                description="Configura inventario antes de registrar entradas o salidas."
                title="No hay registros disponibles"
              />
            ) : (
              <InventoryMovementForm
                disabled={createMovement.isPending}
                inventoryItems={inventoryItems}
                onSubmit={prepareMovement}
              />
            )}
          </CardContent>
        </Card>

        <section className="space-y-4" aria-labelledby="movement-history-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="movement-history-title" className="text-xl font-bold text-ink-950">
                Historial
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                Registro cronológico de entradas, salidas y ajustes.
              </p>
            </div>
            {movementQuery.data ? (
              <Badge tone="neutral">{movementQuery.data.totalItems} movimientos</Badge>
            ) : null}
          </div>

          <Card>
            <CardContent className="pt-5 sm:pt-6">
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                <div className="space-y-2 sm:col-span-2 2xl:col-span-1">
                  <Label htmlFor="movement-history-search">Buscar</Label>
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                    />
                    <Input
                      className="pl-10"
                      id="movement-history-search"
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Producto, SKU o motivo"
                      type="search"
                      value={search}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-history-item">Producto o lote</Label>
                  <select
                    className={SELECT_STYLES}
                    id="movement-history-item"
                    onChange={(event) => {
                      setInventoryItemId(event.target.value);
                      setPage(1);
                    }}
                    value={inventoryItemId}
                  >
                    <option value="">Todos</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.productName} · {item.batch ?? "sin lote"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-history-type">Tipo</Label>
                  <select
                    className={SELECT_STYLES}
                    id="movement-history-type"
                    onChange={(event) => updateMovementType(event.target.value)}
                    value={movementType}
                  >
                    <option value="">Todos</option>
                    {INVENTORY_MOVEMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {inventoryMovementTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-date-from">Desde</Label>
                  <Input
                    id="movement-date-from"
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setPage(1);
                    }}
                    type="date"
                    value={dateFrom}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-date-to">Hasta</Label>
                  <Input
                    id="movement-date-to"
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setPage(1);
                    }}
                    type="date"
                    value={dateTo}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {movementQuery.isPending ? (
            <div className="space-y-3" aria-label="Cargando historial de movimientos">
              <LoadingSkeleton className="h-24 rounded-2xl" />
              <LoadingSkeleton className="h-24 rounded-2xl" />
            </div>
          ) : movementQuery.isError || !movementQuery.data ? (
            <ErrorState
              action={
                <Button onClick={() => void movementQuery.refetch()}>
                  Reintentar
                </Button>
              }
              description="El formulario sigue disponible, pero el historial no pudo consultarse."
              title="No pudimos cargar los movimientos"
            />
          ) : movementQuery.data.items.length === 0 ? (
            <EmptyState
              action={
                hasHistoryFilters ? (
                  <Button
                    onClick={() => {
                      setSearch("");
                      setInventoryItemId("");
                      setMovementType("");
                      setDateFrom("");
                      setDateTo("");
                      setPage(1);
                    }}
                    variant="outline"
                  >
                    Limpiar filtros
                  </Button>
                ) : undefined
              }
              description="Los movimientos confirmados aparecerán en orden cronológico."
              title="No hay movimientos para mostrar"
            />
          ) : (
            <div className="space-y-4">
              <InventoryMovementResults movements={movementQuery.data.items} />
              <InventoryPagination
                onPageChange={setPage}
                page={movementQuery.data.page}
                totalItems={movementQuery.data.totalItems}
                totalPages={movementQuery.data.totalPages}
              />
            </div>
          )}
        </section>
      </div>

      <ConfirmationDialog
        confirmLabel="Registrar movimiento"
        description={
          candidateItem && candidate
            ? `${inventoryMovementTypeLabels[candidate.type]} · ${candidate.quantity} unidades · ${candidateItem.productName}`
            : "Revisa el impacto antes de confirmar."
        }
        onConfirm={() => void confirmMovement()}
        onOpenChange={(open) => {
          setConfirmationOpen(open);
          if (!open && !createMovement.isPending) {
            setCandidate(undefined);
            setPreview(undefined);
          }
        }}
        open={confirmationOpen}
        pending={createMovement.isPending}
        title="Confirmar movimiento de inventario"
        tone="danger"
      >
        {preview ? <InventoryMovementPreviewCard preview={preview} /> : null}
      </ConfirmationDialog>
    </div>
  );
}
