import { describe, expect, it } from "vitest";

import { MockProductService } from "@/features/products/services/mock-product-service";

import { MockInventoryService } from "./mock-inventory-service";

describe("MockInventoryService catalogue projection", () => {
  it("propagates movement stock to product reads without exposing a product stock write", async () => {
    const inventory = new MockInventoryService(
      undefined,
      undefined,
      () => new Date("2026-08-30T12:00:00.000Z"),
    );
    const products = new MockProductService(
      undefined,
      (productId) => inventory.getAvailableStockByProductId(productId),
    );

    await inventory.createMovement({
      inventoryItemId: "inventory-merluza-l2208",
      type: "SALE",
      quantity: 7,
      adjustmentDirection: "DECREASE",
    });

    await expect(products.getById("product-merluza")).resolves.toMatchObject({
      availableStock: 14,
    });
  });

  it("recalculates expiry on read and removes expired units from availability", async () => {
    const inventory = new MockInventoryService(
      [
        {
          id: "inventory-expired-read",
          productId: "product-merluza",
          sku: "PES-MER-010",
          productName: "Filetes de merluza austral 800 g",
          categoryId: "category-meat",
          categoryName: "Carnes y pescados",
          physicalStock: 5,
          reservedStock: 0,
          availableStock: 5,
          minimumStock: 2,
          location: "Cámara fría · F-05",
          expiresAt: "2026-08-29T23:59:59.000Z",
          status: "OK",
          updatedAt: "2026-08-28T20:30:00.000Z",
        },
      ],
      [],
      () => new Date("2026-08-30T12:00:00.000Z"),
    );

    await expect(inventory.getById("inventory-expired-read")).resolves.toMatchObject({
      availableStock: 0,
      status: "EXPIRED",
    });
    expect(inventory.getAvailableStockByProductId("product-merluza")).toBe(0);
  });
});
