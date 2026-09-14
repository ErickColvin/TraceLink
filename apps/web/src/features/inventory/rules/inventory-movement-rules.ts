import type {
  CreateInventoryMovementInput,
  InventoryItem,
  InventoryMovementPreview,
  InventoryMovementType,
  InventoryStatus,
  InventoryStockSnapshot,
} from "../domain";

const OUTGOING_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "SALE",
  "DAMAGE",
  "EXPIRED",
  "TRANSFER_OUT",
]);

const INCOMING_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "PURCHASE_RECEIPT",
  "RETURN",
  "TRANSFER_IN",
]);

const REASON_REQUIRED_MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "ADJUSTMENT",
  "DAMAGE",
  "EXPIRED",
]);

const EXPIRING_WINDOW_MS = 14 * 24 * 60 * 60 * 1_000;

export class InventoryMovementRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryMovementRuleError";
  }
}

export function inventoryMovementRequiresReason(
  type: InventoryMovementType,
): boolean {
  return REASON_REQUIRED_MOVEMENT_TYPES.has(type);
}

export function getInventoryMovementDelta(
  input: CreateInventoryMovementInput,
): number {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new InventoryMovementRuleError(
      "La cantidad debe ser un número entero mayor que cero.",
    );
  }

  if (INCOMING_MOVEMENT_TYPES.has(input.type)) return input.quantity;
  if (OUTGOING_MOVEMENT_TYPES.has(input.type)) return -input.quantity;

  return input.adjustmentDirection === "INCREASE"
    ? input.quantity
    : -input.quantity;
}

export function deriveInventoryStatus(
  stock: InventoryStockSnapshot,
  minimumStock: number,
  expiresAt: string | undefined,
  now = new Date(),
): InventoryStatus {
  const expiryTime = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const timeUntilExpiry = expiryTime - now.getTime();

  if (!Number.isNaN(expiryTime) && timeUntilExpiry <= 0) return "EXPIRED";
  if (stock.physicalStock === 0 || stock.availableStock === 0) return "OUT";
  if (!Number.isNaN(expiryTime) && timeUntilExpiry <= EXPIRING_WINDOW_MS) {
    return "EXPIRING";
  }
  if (stock.availableStock <= minimumStock) return "LOW";
  return "OK";
}

export function previewInventoryMovement(
  item: InventoryItem,
  input: CreateInventoryMovementInput,
  now = new Date(),
): InventoryMovementPreview {
  if (item.id !== input.inventoryItemId) {
    throw new InventoryMovementRuleError(
      "El movimiento no corresponde al registro de inventario seleccionado.",
    );
  }

  if (
    inventoryMovementRequiresReason(input.type) &&
    !input.reason?.trim()
  ) {
    throw new InventoryMovementRuleError(
      "Debes indicar un motivo para este tipo de movimiento.",
    );
  }

  if (input.type === "TRANSFER_IN" && !input.originLocation?.trim()) {
    throw new InventoryMovementRuleError(
      "Debes indicar la ubicación de origen de la transferencia.",
    );
  }

  if (input.type === "TRANSFER_OUT" && !input.destinationLocation?.trim()) {
    throw new InventoryMovementRuleError(
      "Debes indicar la ubicación de destino de la transferencia.",
    );
  }

  const quantityDelta = getInventoryMovementDelta(input);
  const before: InventoryStockSnapshot = {
    physicalStock: item.physicalStock,
    reservedStock: item.reservedStock,
    availableStock: item.availableStock,
  };
  const nextPhysicalStock = before.physicalStock + quantityDelta;
  const nextReservedStock =
    input.type === "SALE"
      ? Math.max(0, before.reservedStock - input.quantity)
      : before.reservedStock;

  if (nextPhysicalStock < 0) {
    throw new InventoryMovementRuleError(
      "El movimiento dejaría el stock físico bajo cero.",
    );
  }

  if (nextPhysicalStock < nextReservedStock) {
    throw new InventoryMovementRuleError(
      "No puedes retirar unidades que ya están reservadas.",
    );
  }

  const after: InventoryStockSnapshot = {
    physicalStock: nextPhysicalStock,
    reservedStock: nextReservedStock,
    availableStock:
      item.expiresAt && Date.parse(item.expiresAt) <= now.getTime()
        ? 0
        : nextPhysicalStock - nextReservedStock,
  };

  return {
    inventoryItemId: item.id,
    quantityDelta,
    before,
    after,
    resultingStatus: deriveInventoryStatus(
      after,
      item.minimumStock,
      item.expiresAt,
      now,
    ),
  };
}
