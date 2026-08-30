import { describe, expect, it } from "vitest";

import {
  canCancelOrder,
  canTransitionOrder,
  getNextOrderStatus,
} from "./order-workflow";

describe("order workflow", () => {
  it("expone solo la secuencia operativa permitida", () => {
    expect(getNextOrderStatus("PENDING_PAYMENT")).toBe("PAID");
    expect(getNextOrderStatus("PAID")).toBe("PREPARING");
    expect(getNextOrderStatus("PREPARING")).toBe("READY");
    expect(getNextOrderStatus("READY")).toBe("COMPLETED");
    expect(getNextOrderStatus("COMPLETED")).toBeNull();
  });

  it("bloquea saltos y estados terminales", () => {
    expect(canTransitionOrder("PENDING_PAYMENT", "PREPARING")).toBe(false);
    expect(canTransitionOrder("READY", "COMPLETED")).toBe(true);
    expect(canTransitionOrder("CANCELLED", "PAID")).toBe(false);
    expect(canCancelOrder("PREPARING")).toBe(true);
    expect(canCancelOrder("COMPLETED")).toBe(false);
  });
});
