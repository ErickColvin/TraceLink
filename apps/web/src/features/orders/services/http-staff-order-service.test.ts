import { describe, expect, it, vi } from "vitest";

import { HttpClient } from "../../../lib/http/http-client";
import type { StaffOrder } from "../domain";
import { HttpStaffOrderService } from "./http-staff-order-service";

const staffOrder: StaffOrder = {
  id: "order/unsafe",
  orderNumber: "CH-100",
  customerId: "customer-1",
  status: "PAID",
  paymentStatus: "PAID",
  fulfillmentMethod: "PICKUP",
  items: [],
  subtotal: 1_000,
  discountTotal: 0,
  deliveryFee: 0,
  total: 1_000,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:05:00.000Z",
  packageIds: [],
  customer: {
    id: "customer-1",
    fullName: "Cliente Demo",
    email: "customer@example.cl",
  },
  statusEvents: [],
};

describe("HttpStaffOrderService", () => {
  it("mapea path/body sin confiar en actor y reutiliza idempotency key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(staffOrder), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpClient("https://api.test/api/v1", fetchMock);
    client.setCsrfToken("csrf-test");
    const service = new HttpStaffOrderService(client);

    await service.transitionStatus(
      {
        orderId: "order/unsafe",
        toStatus: "PAID",
        actor: { id: "spoofed", name: "Spoofed actor" },
      },
      { idempotencyKey: "same-operation-123" },
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.test/api/v1/staff/orders/order%2Funsafe/transitions",
    );
    expect(init?.body).toBe('{"toStatus":"PAID"}');
    const headers = new Headers(init?.headers);
    expect(headers.get("idempotency-key")).toBe("same-operation-123");
    expect(headers.get("x-csrf-token")).toBe("csrf-test");
  });
});
