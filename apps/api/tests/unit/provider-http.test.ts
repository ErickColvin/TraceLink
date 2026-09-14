import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchProviderJson } from "../../src/modules/payments/provider-http.js";
import { PaymentProviderError } from "../../src/modules/payments/payment-provider-error.js";

function jsonResponse(
  body: unknown,
  status = 200,
  headers?: Readonly<Record<string, string>>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    ...(headers === undefined ? {} : { headers }),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchProviderJson", () => {
  it("sends authorization, JSON and the caller's idempotency key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ id: "provider-order-1" }),
    );

    await expect(fetchProviderJson({
      url: "https://provider.test/v1/orders",
      accessToken: "access-token-test",
      method: "POST",
      body: { total_amount: "12990" },
      idempotencyKey: "attempt-123",
      fetchImplementation: fetchMock,
    })).resolves.toEqual({ id: "provider-order-1" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://provider.test/v1/orders");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"total_amount":"12990"}');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const requestHeaders = new Headers(init?.headers);
    expect(requestHeaders.get("accept")).toBe("application/json");
    expect(requestHeaders.get("authorization")).toBe("Bearer access-token-test");
    expect(requestHeaders.get("content-type")).toBe("application/json");
    expect(requestHeaders.get("x-idempotency-key")).toBe("attempt-123");
  });

  it("honors Retry-After before retrying a 429 response", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "rate_limited" }, 429, {
        "Retry-After": "2",
      }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = fetchProviderJson({
      url: "https://provider.test/v1/orders/order-1",
      accessToken: "access-token-test",
      fetchImplementation: fetchMock,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(request).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient 5xx responses with exponential backoff", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: "temporary" }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: "temporary" }, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const request = fetchProviderJson({
      url: "https://provider.test/v1/orders/order-1",
      accessToken: "access-token-test",
      fetchImplementation: fetchMock,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(400);
    await expect(request).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-transient 4xx responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: "invalid_request" }, 400),
    );

    const error = await fetchProviderJson({
      url: "https://provider.test/v1/orders",
      accessToken: "access-token-test",
      method: "POST",
      body: { invalid: true },
      fetchImplementation: fetchMock,
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(PaymentProviderError);
    expect(error).toMatchObject({ retryable: false, statusCode: 400 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
