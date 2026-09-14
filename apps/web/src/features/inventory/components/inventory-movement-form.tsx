import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightLeft, CalendarClock, MapPin } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { Button, Input, Label } from "@/components/ui";
import { formatDate } from "@/lib/formatters";

import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryItem,
} from "../domain";
import { inventoryMovementTypeLabels } from "../presentation/inventory-presentation";
import { inventoryMovementRequiresReason } from "../rules/inventory-movement-rules";
import {
  inventoryMovementSchema,
  type InventoryMovementFormValues,
} from "../schemas/inventory-movement-schema";

const SELECT_STYLES =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm hover:border-ink-300 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60 aria-[invalid=true]:border-coral-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-coral-100";

const TEXTAREA_STYLES =
  "min-h-24 w-full resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm placeholder:text-ink-400 hover:border-ink-300 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60 aria-[invalid=true]:border-coral-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-coral-100";

export interface InventoryMovementFormProps {
  disabled?: boolean;
  inventoryItems: InventoryItem[];
  onSubmit: (values: InventoryMovementFormValues) => void;
}

export function InventoryMovementForm({
  disabled = false,
  inventoryItems,
  onSubmit,
}: InventoryMovementFormProps) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<InventoryMovementFormValues>({
    resolver: zodResolver(inventoryMovementSchema),
    defaultValues: {
      inventoryItemId: inventoryItems[0]?.id ?? "",
      type: "PURCHASE_RECEIPT",
      quantity: 1,
      adjustmentDirection: "INCREASE",
      originLocation: "",
      destinationLocation: "",
      reason: "",
      notes: "",
    },
  });
  const movementType = useWatch({ control, name: "type" });
  const selectedInventoryItemId = useWatch({
    control,
    name: "inventoryItemId",
  });
  const selectedItem = inventoryItems.find(
    (item) => item.id === selectedInventoryItemId,
  );
  const reasonRequired = inventoryMovementRequiresReason(movementType);

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="movement-item">Producto y lote</Label>
        <select
          aria-describedby={errors.inventoryItemId ? "movement-item-error" : undefined}
          aria-invalid={Boolean(errors.inventoryItemId)}
          className={SELECT_STYLES}
          disabled={disabled || inventoryItems.length === 0}
          id="movement-item"
          {...register("inventoryItemId")}
        >
          <option value="">Selecciona un registro</option>
          {inventoryItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.productName} · {item.batch ?? "sin lote"} · {item.availableStock} disponibles
            </option>
          ))}
        </select>
        {errors.inventoryItemId ? (
          <p className="text-xs text-coral-700" id="movement-item-error">
            {errors.inventoryItemId.message}
          </p>
        ) : null}
      </div>

      {selectedItem ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-800">
            Lote seleccionado
          </p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-ink-500">
                <MapPin aria-hidden="true" className="size-3.5" />
                Ubicación actual
              </dt>
              <dd className="mt-1 font-medium text-ink-900">
                {selectedItem.location}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-ink-500">
                <CalendarClock aria-hidden="true" className="size-3.5" />
                Lote y vencimiento
              </dt>
              <dd className="mt-1 font-medium text-ink-900">
                {selectedItem.batch ?? "Sin lote"} ·{" "}
                {selectedItem.expiresAt
                  ? formatDate(selectedItem.expiresAt)
                  : "Sin vencimiento"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="movement-type">Tipo de movimiento</Label>
          <select
            className={SELECT_STYLES}
            disabled={disabled}
            id="movement-type"
            {...register("type")}
          >
            {INVENTORY_MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {inventoryMovementTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="movement-quantity">Cantidad</Label>
          <Input
            aria-describedby={errors.quantity ? "movement-quantity-error" : undefined}
            aria-invalid={Boolean(errors.quantity)}
            disabled={disabled}
            id="movement-quantity"
            inputMode="numeric"
            min={1}
            step={1}
            type="number"
            {...register("quantity", { valueAsNumber: true })}
          />
          {errors.quantity ? (
            <p className="text-xs text-coral-700" id="movement-quantity-error">
              {errors.quantity.message}
            </p>
          ) : null}
        </div>
      </div>

      {movementType === "ADJUSTMENT" ? (
        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-sm font-medium text-ink-950">
            Dirección del ajuste
          </legend>
          <div className="mt-2 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                className="size-4 accent-brand-700"
                disabled={disabled}
                type="radio"
                value="INCREASE"
                {...register("adjustmentDirection")}
              />
              Aumentar stock
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                className="size-4 accent-brand-700"
                disabled={disabled}
                type="radio"
                value="DECREASE"
                {...register("adjustmentDirection")}
              />
              Disminuir stock
            </label>
          </div>
        </fieldset>
      ) : null}

      {movementType === "TRANSFER_IN" ? (
        <div className="space-y-2">
          <Label htmlFor="movement-origin-location">
            Ubicación de origen (obligatoria)
          </Label>
          <Input
            aria-describedby={
              errors.originLocation ? "movement-origin-location-error" : undefined
            }
            aria-invalid={Boolean(errors.originLocation)}
            disabled={disabled}
            id="movement-origin-location"
            placeholder="Ej. Cámara auxiliar · AUX-01"
            {...register("originLocation")}
          />
          {errors.originLocation ? (
            <p className="text-xs text-coral-700" id="movement-origin-location-error">
              {errors.originLocation.message}
            </p>
          ) : null}
          {selectedItem ? (
            <p className="text-xs text-ink-500">
              Destino: {selectedItem.location}
            </p>
          ) : null}
        </div>
      ) : null}

      {movementType === "TRANSFER_OUT" ? (
        <div className="space-y-2">
          <Label htmlFor="movement-destination-location">
            Ubicación de destino (obligatoria)
          </Label>
          <Input
            aria-describedby={
              errors.destinationLocation
                ? "movement-destination-location-error"
                : undefined
            }
            aria-invalid={Boolean(errors.destinationLocation)}
            disabled={disabled}
            id="movement-destination-location"
            placeholder="Ej. Punto de venta secundario"
            {...register("destinationLocation")}
          />
          {errors.destinationLocation ? (
            <p
              className="text-xs text-coral-700"
              id="movement-destination-location-error"
            >
              {errors.destinationLocation.message}
            </p>
          ) : null}
          {selectedItem ? (
            <p className="text-xs text-ink-500">
              Origen: {selectedItem.location}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="movement-reason">
          Motivo {reasonRequired ? "(obligatorio)" : "(opcional)"}
        </Label>
        <textarea
          aria-describedby={errors.reason ? "movement-reason-error" : "movement-reason-help"}
          aria-invalid={Boolean(errors.reason)}
          aria-required={reasonRequired}
          className={TEXTAREA_STYLES}
          disabled={disabled}
          id="movement-reason"
          placeholder="Explica por qué se registra este movimiento"
          {...register("reason")}
        />
        {errors.reason ? (
          <p className="text-xs text-coral-700" id="movement-reason-error">
            {errors.reason.message}
          </p>
        ) : (
          <p className="text-xs text-ink-500" id="movement-reason-help">
            Es obligatorio en ajustes, daños y vencimientos.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="movement-notes">Notas internas (opcional)</Label>
        <textarea
          aria-describedby={errors.notes ? "movement-notes-error" : undefined}
          aria-invalid={Boolean(errors.notes)}
          className={TEXTAREA_STYLES}
          disabled={disabled}
          id="movement-notes"
          placeholder="Documento de referencia, traslado u otra observación"
          {...register("notes")}
        />
        {errors.notes ? (
          <p className="text-xs text-coral-700" id="movement-notes-error">
            {errors.notes.message}
          </p>
        ) : null}
      </div>

      <Button
        className="w-full sm:w-auto"
        disabled={disabled || isSubmitting || inventoryItems.length === 0}
        type="submit"
      >
        <ArrowRightLeft aria-hidden="true" className="size-4" />
        Revisar movimiento
      </Button>
    </form>
  );
}
