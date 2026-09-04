import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import {
  buildRequestUrl,
  HttpClient,
  HttpClientError,
  resolveIdempotencyKey,
} from "./http-client";

function jsonResponse(
  body: unknown,
  options: Readonly<{ status?: number; requestId?: string }> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": options.requestId ?? "req-test",
    },
  });
}

describe("HttpClient", () => {
  it("incluye credenciales, CSRF, JSON, idempotencia y query arrays", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ ok: true }),
    );
    const client = new HttpClient("https://api.test/api/v1/", fetchMock);
    client.setCsrfToken("csrf-token-test");

    await client.request("/staff/orders", {
      method: "POST",
      query: { statuses: ["PAID", "READY"], active: false, empty: "" },
      body: { status: "READY" },
      csrf: true,
      idempotencyKey: "idem-request-123",
      responseSchema: z.object({ ok: z.literal(true) }),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.test/api/v1/staff/orders?statuses=PAID&statuses=READY&active=false",
    );
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe('{"status":"READY"}');
    const headers = new Headers(init?.headers);
    expect(headers.get("x-csrf-token")).toBe("csrf-token-test");
    expect(headers.get("idempotency-key")).toBe("idem-request-123");
    expect(headers.get("content-type")).toBe("application/json");
    expect(client.lastRequestId).toBe("req-test");
  });

  it("normaliza errores API y conserva request id y field errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos inválidos.",
            fieldErrors: { email: ["Correo inválido"] },
          },
          requestId: "req-body",
        },
        { status: 400, requestId: "req-header" },
      ),
    );
    const client = new HttpClient("https://api.test/api/v1", fetchMock);

    const error = await client
      .request("/resource", {
        responseSchema: z.object({ ok: z.boolean() }),
      })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpClientError);
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Datos inválidos.",
      requestId: "req-body",
      status: 400,
      fieldErrors: { email: ["Correo inválido"] },
    });
  });

  it("rechaza respuestas que no cumplen Zod", async () => {
    const client = new HttpClient(
      "https://api.test/api/v1",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: "yes" })),
    );

    await expect(
      client.request("/resource", {
        responseSchema: z.object({ ok: z.boolean() }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("no envía una mutación protegida sin token CSRF", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new HttpClient("https://api.test/api/v1", fetchMock);

    await expect(
      client.requestVoid("/auth/logout", { method: "POST", csrf: true }),
    ).rejects.toMatchObject({ code: "CSRF_TOKEN_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permite conservar una clave de idempotencia provista por el caller", () => {
    expect(resolveIdempotencyKey({ idempotencyKey: "retry-key-123" })).toBe(
      "retry-key-123",
    );
    expect(resolveIdempotencyKey()).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("codifica false y omite valores vacíos en la URL", () => {
    expect(
      buildRequestUrl("https://api.test", "/items", {
        enabled: false,
        page: 2,
        ignored: undefined,
      }),
    ).toBe("https://api.test/items?enabled=false&page=2");
  });
});
