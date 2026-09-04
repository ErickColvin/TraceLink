import { describe, expect, it } from "vitest";

import {
  canCancelOrder,
  canTransitionOrder,
  getNextOrderStatus,
} from "../../src/modules/orders/order-workflow.js";

describe("authoritative order workflow", () => {
  it("allows only the next state in the commercial fulfillment path", () => {
    expect(getNextOrderStatus("PENDING_PAYMENT")).toBe("PAID");
    expect(getNextOrderStatus("PAID")).toBe("PREPARING");
    expect(getNextOrderStatus("PREPARING")).toBe("READY");
    expect(getNextOrderStatus("READY")).toBe("COMPLETED");
    expect(getNextOrderStatus("COMPLETED")).toBeNull();
    expect(getNextOrderStatus("CANCELLED")).toBeNull();
    expect(getNextOrderStatus("REFUNDED")).toBeNull();
  });

  it("rejects skipped, repeated, cancelled, and refunded transitions", () => {
    expect(canTransitionOrder("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransitionOrder("PENDING_PAYMENT", "PREPARING")).toBe(false);
    expect(canTransitionOrder("PAID", "PAID")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "COMPLETED")).toBe(false);
    expect(canTransitionOrder("REFUNDED", "COMPLETED")).toBe(false);
  });

  it("permits cancellation only before a terminal state", () => {
    expect(canCancelOrder("PENDING_PAYMENT")).toBe(true);
    expect(canCancelOrder("PAID")).toBe(true);
    expect(canCancelOrder("PREPARING")).toBe(true);
    expect(canCancelOrder("READY")).toBe(true);
    expect(canCancelOrder("COMPLETED")).toBe(false);
    expect(canCancelOrder("CANCELLED")).toBe(false);
    expect(canCancelOrder("REFUNDED")).toBe(false);
  });
});
