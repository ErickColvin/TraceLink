import { describe, expect, it, vi } from "vitest";

import { HttpClient } from "../../../lib/http/http-client";
import { HttpStaffPackageService } from "./http-staff-package-service";

const wirePackage = {
  id: "package-1",
  trackingCode: "CHM-100",
  customerId: "customer-1",
  status: "RECEIVED",
  contents: {
    description: "Caja demo",
    itemCount: 1,
    requiresColdStorage: false,
  },
  receivedAt: "2026-09-01T10:00:00.000Z",
  storageLocation: "Bodega A",
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  carrier: "CH Market",
  customer: {
    id: "customer-1",
    fullName: "Cliente Demo",
    email: "customer@example.cl",
  },
  events: [
    {
      id: "event-1",
      previousStatus: "EXPECTED",
      newStatus: "RECEIVED",
      occurredAt: "2026-09-01T10:00:00.000Z",
      description: "Recepción confirmada.",
      actor: { id: "user-1", name: "Staff Real" },
    },
  ],
} as const;

describe("HttpStaffPackageService", () => {
  it("mapea eventos canónicos y excluye actor del request wire", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(wirePackage), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new HttpClient("https://api.test/api/v1", fetchMock);
    client.setCsrfToken("csrf-test");
    const service = new HttpStaffPackageService(client);

    const result = await service.receive(
      {
        trackingCode: "CHM-100",
        carrier: "CH Market",
        customerId: "customer-1",
        contents: {
          description: "Caja demo",
          itemCount: 1,
          requiresColdStorage: false,
        },
        storageLocation: "Bodega A",
        actor: { id: "spoofed", name: "Actor enviado por UI" },
      },
      { idempotencyKey: "package-operation-123" },
    );

    expect(result.events[0]).toMatchObject({
      status: "RECEIVED",
      createdAt: "2026-09-01T10:00:00.000Z",
      recordedBy: "Staff Real",
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("actor");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("idempotency-key")).toBe(
      "package-operation-123",
    );
  });

  it("consulta opciones mínimas sin usar el directorio de clientes", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "customer-1",
              displayName: "Cliente Demo",
              email: "customer@example.cl",
            },
          ],
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const service = new HttpStaffPackageService(
      new HttpClient("https://api.test/api/v1", fetchMock),
    );

    await service.listCustomerOptions({ search: "demo" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.test/api/v1/staff/package-customer-options?search=demo",
    );
  });
});
