import { z } from "zod";

import {
  INVENTORY_ADJUSTMENT_DIRECTIONS,
  INVENTORY_MOVEMENT_TYPES,
} from "../domain";
import { inventoryMovementRequiresReason } from "../rules/inventory-movement-rules";

export const inventoryMovementSchema = z
  .object({
    inventoryItemId: z.string().min(1, "Selecciona un producto o lote."),
    type: z.enum(INVENTORY_MOVEMENT_TYPES),
    quantity: z
      .number({ error: "Ingresa una cantidad válida." })
      .int("La cantidad debe ser un número entero.")
      .positive("La cantidad debe ser mayor que cero."),
    adjustmentDirection: z.enum(INVENTORY_ADJUSTMENT_DIRECTIONS),
    originLocation: z
      .string()
      .trim()
      .max(120, "La ubicación de origen no puede superar 120 caracteres.")
      .optional(),
    destinationLocation: z
      .string()
      .trim()
      .max(120, "La ubicación de destino no puede superar 120 caracteres.")
      .optional(),
    reason: z
      .string()
      .trim()
      .max(240, "El motivo no puede superar 240 caracteres.")
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, "Las notas no pueden superar 500 caracteres.")
      .optional(),
  })
  .superRefine((value, context) => {
    if (inventoryMovementRequiresReason(value.type) && !value.reason) {
      context.addIssue({
        code: "custom",
        message: "El motivo es obligatorio para este movimiento.",
        path: ["reason"],
      });
    }
    if (value.type === "TRANSFER_IN" && !value.originLocation) {
      context.addIssue({
        code: "custom",
        message: "Indica la ubicación de origen de la transferencia.",
        path: ["originLocation"],
      });
    }
    if (value.type === "TRANSFER_OUT" && !value.destinationLocation) {
      context.addIssue({
        code: "custom",
        message: "Indica la ubicación de destino de la transferencia.",
        path: ["destinationLocation"],
      });
    }
  });

export type InventoryMovementFormValues = z.infer<
  typeof inventoryMovementSchema
>;
