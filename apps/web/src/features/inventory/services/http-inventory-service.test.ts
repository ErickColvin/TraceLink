import { describe, expect, it, vi } from "vitest";

import { HttpClient } from "../../../lib/http/http-client";
import { HttpInventoryService } from "./http-inventory-service";

const movementResponse = {
  id: "movement-1",
  inventoryItemId: "balance-1",
  productId: "product-1",
  sku: "SKU-1",
  productName: "Producto E2E",
  type: "PURCHASE_RECEIPT",
  quantity: 3,
  quantityDelta: 3,
  before: {
    physicalStock: 10,
    reservedStock: 0,
    availableStock: 10,
  },
  after: {
    physicalStock: 13,
    reservedStock: 0,
    availableStock: 13,
  },
  resultingStatus: "OK",
  originLocation: "Proveedor / recepción",
  createdAt: "2026-09-04T10:00:00.000Z",
  createdBy: "Admin E2E",
} as const;

describe("HttpInventoryService", () => {
  it("omite campos opcionales vacíos del body de movimientos", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(movementResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpClient("https://api.test/api/v1", fetchMock);
    client.setCsrfToken("csrf-test");
    const service = new HttpInventoryService(client);

    await service.createMovement(
      {
        inventoryItemId: "balance-1",
        type: "PURCHASE_RECEIPT",
        quantity: 3,
        adjustmentDirection: "INCREASE",
        originLocation: "  ",
        destinationLocation: "",
        reason: " Recepción comprobada ",
        notes: "",
      },
      { idempotencyKey: "inventory-operation-123" },
    );

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        inventoryItemId: "balance-1",
        type: "PURCHASE_RECEIPT",
        quantity: 3,
        adjustmentDirection: "INCREASE",
        reason: "Recepción comprobada",
      }),
    );
  });
});
