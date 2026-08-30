import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/features/orders";
import { getOrderStatusMeta } from "@/features/orders/presentation/order-status";

describe("getOrderStatusMeta", () => {
  it("entrega etiqueta y explicación para cada estado permitido", () => {
    for (const status of ORDER_STATUSES) {
      const meta = getOrderStatusMeta(status);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("distingue los estados que requieren atención", () => {
    expect(getOrderStatusMeta("PENDING_PAYMENT").tone).toBe("warning");
    expect(getOrderStatusMeta("CANCELLED").tone).toBe("danger");
    expect(getOrderStatusMeta("READY").label).toBe("Listo para retiro");
  });
});

