import type { BadgeTone } from "@/components/ui";

import type { InventoryMovementType, InventoryStatus } from "../domain";

export interface InventoryStatusPresentation {
  label: string;
  description: string;
  tone: BadgeTone;
}

export const inventoryStatusPresentation: Record<
  InventoryStatus,
  InventoryStatusPresentation
> = {
  OK: {
    label: "OK",
    description: "Disponibilidad sobre el mínimo configurado.",
    tone: "success",
  },
  LOW: {
    label: "Stock bajo",
    description: "Disponibilidad igual o menor al mínimo.",
    tone: "warning",
  },
  OUT: {
    label: "Sin stock",
    description: "No existen unidades disponibles.",
    tone: "danger",
  },
  EXPIRING: {
    label: "Próximo a vencer",
    description: "El lote vence dentro de los próximos 14 días.",
    tone: "warning",
  },
  EXPIRED: {
    label: "Vencido",
    description: "El lote está vencido y no está disponible.",
    tone: "danger",
  },
};

export const inventoryMovementTypeLabels: Record<
  InventoryMovementType,
  string
> = {
  PURCHASE_RECEIPT: "Recepción de compra",
  SALE: "Venta",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolución",
  DAMAGE: "Daño",
  EXPIRED: "Vencimiento",
  TRANSFER_IN: "Transferencia de entrada",
  TRANSFER_OUT: "Transferencia de salida",
};
