import { describe, expect, it, vi } from "vitest";

import { HttpClient } from "../../../lib/http/http-client";
import { HttpAuthService } from "./http-auth-service";

const staffEnvelope = {
  session: {
    user: {
      id: "user-1",
      email: "admin@example.cl",
      firstName: "Ada",
      lastName: "Lovelace",
    },
    audience: "staff",
    organization: { id: "org-1", slug: "ch-market", name: "CH Market" },
    membership: { id: "membership-1", status: "ACTIVE" },
    role: { id: "role-1", code: "WAREHOUSE", name: "Bodega" },
    permissions: ["packages.view", "packages.update"],
    authenticatedAt: "2026-09-01T10:00:00.000Z",
  },
  csrfToken: "x".repeat(32),
} as const;

const customerEnvelope = {
  session: {
    user: {
      id: "user-customer-1",
      email: "valentina@example.cl",
      firstName: "Valentina",
      lastName: "Rojas",
    },
    audience: "customer",
    organization: { id: "org-1", slug: "ch-market", name: "CH Market" },
    customer: { id: "customer-1" },
    permissions: [],
    authenticatedAt: "2026-09-06T10:00:00.000Z",
  },
  csrfToken: "r".repeat(32),
} as const;

describe("HttpAuthService", () => {
  it("proyecta la sesión remota y usa el CSRF recibido al salir", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(staffEnvelope), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = new HttpAuthService(
      new HttpClient("https://api.test/api/v1", fetchMock),
    );

    await expect(
      service.signIn({
        audience: "staff",
        email: "admin@example.cl",
        password: "secret",
      }),
    ).resolves.toMatchObject({
      kind: "staff",
      authSource: "remote",
      staff: { role: "WAREHOUSE", roleLabel: "Bodega" },
    });
    await service.signOut();

    const logoutHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(logoutHeaders.get("x-csrf-token")).toBe(staffEnvelope.csrfToken);
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  });

  it("convierte solo un 401 de auth/me en sesión anónima", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "UNAUTHENTICATED", message: "Sin sesión." },
          requestId: "req-auth",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const service = new HttpAuthService(
      new HttpClient("https://api.test/api/v1", fetchMock),
    );

    await expect(service.getSession()).resolves.toEqual({ kind: "anonymous" });
  });

  it("registra un customer, proyecta la sesión y conserva el CSRF", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(customerEnvelope), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = new HttpAuthService(
      new HttpClient("https://api.test/api/v1", fetchMock),
    );

    await expect(
      service.register({
        firstName: "Valentina",
        lastName: "Rojas",
        email: "valentina@example.cl",
        password: "una-clave-segura-123",
        phone: "+56912345678",
      }),
    ).resolves.toMatchObject({
      kind: "customer",
      authSource: "remote",
      customer: {
        customerId: "customer-1",
        email: "valentina@example.cl",
      },
    });
    await service.signOut();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.test/api/v1/auth/register",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        firstName: "Valentina",
        lastName: "Rojas",
        email: "valentina@example.cl",
        password: "una-clave-segura-123",
        phone: "+56912345678",
      }),
    );
    const logoutHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(logoutHeaders.get("x-csrf-token")).toBe(customerEnvelope.csrfToken);
  });

  it("deshabilita accesos demo en modo HTTP", async () => {
    const service = new HttpAuthService(
      new HttpClient("https://api.test/api/v1", vi.fn<typeof fetch>()),
    );

    await expect(service.startDemoSession("customer")).rejects.toMatchObject({
      code: "AUTH_NOT_CONFIGURED",
    });
  });
});
