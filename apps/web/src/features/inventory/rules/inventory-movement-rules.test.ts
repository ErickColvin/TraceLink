import { describe, expect, it } from "vitest";

import type {
  CreateInventoryMovementInput,
  InventoryItem,
  InventoryMovementType,
} from "../domain";
import { MockInventoryService } from "../services/mock-inventory-service";
import {
  InventoryMovementRuleError,
  previewInventoryMovement,
} from "./inventory-movement-rules";

function createItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inventory-test",
    productId: "product-test",
    sku: "SKU-TEST",
    productName: "Producto de prueba",
    categoryId: "category-test",
    categoryName: "Pruebas",
    physicalStock: 20,
    reservedStock: 4,
    availableStock: 16,
    minimumStock: 5,
    location: "Bodega principal · A-01",
    batch: "LOT-001",
    expiresAt: "2099-12-31T23:59:59.000Z",
    status: "OK",
    updatedAt: "2026-08-30T10:00:00.000Z",
    ...overrides,
  };
}

function createInput(
  overrides: Partial<CreateInventoryMovementInput> = {},
): CreateInventoryMovementInput {
  return {
    inventoryItemId: "inventory-test",
    type: "PURCHASE_RECEIPT",
    quantity: 2,
    adjustmentDirection: "INCREASE",
    ...overrides,
  };
}

describe("inventory movement rules", () => {
  it.each<InventoryMovementType>(["ADJUSTMENT", "DAMAGE", "EXPIRED"])(
    "requires a reason for %s",
    (type) => {
      expect(() =>
        previewInventoryMovement(createItem(), createInput({ type })),
      ).toThrow(/motivo/i);
    },
  );

  it("blocks an outgoing movement that would consume reserved stock", () => {
    expect(() =>
      previewInventoryMovement(
        createItem(),
        createInput({ type: "DAMAGE", quantity: 17, reason: "Merma" }),
      ),
    ).toThrow(InventoryMovementRuleError);
  });

  it("releases reserved units when a sale is completed", () => {
    const preview = previewInventoryMovement(
      createItem(),
      createInput({ type: "SALE", quantity: 3 }),
    );

    expect(preview.before).toEqual({
      physicalStock: 20,
      reservedStock: 4,
      availableStock: 16,
    });
    expect(preview.after).toEqual({
      physicalStock: 17,
      reservedStock: 1,
      availableStock: 16,
    });
    expect(preview.quantityDelta).toBe(-3);
  });

  it("requires the external endpoint for transfers", () => {
    expect(() =>
      previewInventoryMovement(
        createItem(),
        createInput({ type: "TRANSFER_IN" }),
      ),
    ).toThrow(/origen/i);
    expect(() =>
      previewInventoryMovement(
        createItem(),
        createInput({ type: "TRANSFER_OUT" }),
      ),
    ).toThrow(/destino/i);
  });
});

describe("MockInventoryService", () => {
  it("persists an auditable adjustment with before and after snapshots", async () => {
    const service = new MockInventoryService([createItem()], []);
    const movement = await service.createMovement(
      createInput({
        type: "ADJUSTMENT",
        adjustmentDirection: "DECREASE",
        quantity: 3,
        reason: "Conteo físico",
      }),
    );
    const item = await service.getById("inventory-test");
    const history = await service.listMovements();

    expect(movement.before.physicalStock).toBe(20);
    expect(movement.after.physicalStock).toBe(17);
    expect(movement.after.availableStock).toBe(13);
    expect(movement.reason).toBe("Conteo físico");
    expect(item.physicalStock).toBe(17);
    expect(history.items).toHaveLength(1);
    expect(history.items[0]?.id).toBe(movement.id);
  });

  it("supports explicit location and expiry filters", async () => {
    const service = new MockInventoryService(
      [
        createItem(),
        createItem({
          id: "inventory-no-expiry",
          location: "Cámara fría · F-02",
          expiresAt: undefined,
        }),
      ],
      [],
    );

    const byLocation = await service.list({ location: "camara fria" });
    const withoutExpiry = await service.list({ expiry: "WITHOUT_EXPIRY" });

    expect(byLocation.items.map((item) => item.id)).toEqual([
      "inventory-no-expiry",
    ]);
    expect(withoutExpiry.items.map((item) => item.id)).toEqual([
      "inventory-no-expiry",
    ]);
  });
});
