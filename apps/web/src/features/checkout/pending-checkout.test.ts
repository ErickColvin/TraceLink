import { beforeEach, describe, expect, it } from "vitest";

import {
  clearPendingCheckout,
  readPendingCheckout,
  rememberPendingCheckout,
} from "./pending-checkout";

describe("pending checkout browser context", () => {
  beforeEach(() => sessionStorage.clear());

  it("stores only the order and authoritative reservation expiry", () => {
    rememberPendingCheckout({
      order: { id: "order-123" },
      reservationExpiresAt: "2026-09-11T12:15:00.000Z",
    });

    expect(readPendingCheckout()).toMatchObject({
      orderId: "order-123",
      reservationExpiresAt: "2026-09-11T12:15:00.000Z",
    });
    clearPendingCheckout();
    expect(readPendingCheckout()).toBeNull();
  });

  it("discards malformed state at the browser boundary", () => {
    sessionStorage.setItem("tracelink.pending-checkout.v1", "not-json");
    expect(readPendingCheckout()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
