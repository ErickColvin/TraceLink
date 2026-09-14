import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mapMercadoPagoOrderStatus,
  MercadoPagoPaymentProvider,
} from "../../src/modules/payments/mercadopago-payment-provider.js";
import type { CreateProviderCheckoutInput } from "../../src/modules/payments/payment-provider.js";

const fixedNow = new Date("2026-09-08T12:00:00.000Z");
const webhookSecret = "mercado-pago-webhook-secret-for-tests";

function providerOrder(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    id: "ORD-123",
    external_reference: "order-local-123",
    status: "created",
    status_detail: "created",
    total_amount: "12990.00",
    currency: "CLP",
    checkout_url: "https://checkout.test/redirect/provider-order",
    transactions: { payments: [{ id: 456 }], refunds: [] },
    ...overrides,
  };
}

function checkoutInput(): CreateProviderCheckoutInput {
  return {
    attemptId: "attempt-123",
    orderId: "order-local-123",
    orderNumber: "CH-00123",
    payerEmail: "buyer@example.test",
    currency: "CLP",
    total: 12_990,
    expiresAt: new Date(fixedNow.getTime() + 30 * 60_000),
    items: [{
      productId: "product-1",
      title: "Aceite de oliva",
      quantity: 2,
      unitPrice: 6_495,
      lineTotal: 12_990,
    }],
  };
}

function createProvider(fetchImplementation: typeof fetch): MercadoPagoPaymentProvider {
  return new MercadoPagoPaymentProvider({
    accessToken: "access-token-test",
    webhookSecret,
    successUrl: "https://shop.test/checkout/success",
    failureUrl: "https://shop.test/checkout/failure",
    pendingUrl: "https://shop.test/checkout/pending",
    fetchImplementation,
  });
}

function signedWebhook(input: Readonly<{
  dataId: string;
  requestId: string;
  timestamp: string;
}>): string {
  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${input.timestamp};`;
  const hash = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
  return `ts=${input.timestamp},v1=${hash}`;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mapMercadoPagoOrderStatus", () => {
  it.each([
    ["created", "created", "PENDING", false],
    ["processing", "in_process", "PENDING", false],
    ["action_required", "waiting_payment", "PENDING", false],
    ["processed", "accredited", "APPROVED", true],
    ["canceled", "canceled", "CANCELLED", true],
    ["cancelled", "cancelled", "CANCELLED", true],
    ["expired", "expired", "CANCELLED", true],
    ["failed", "failed", "REJECTED", true],
    ["rejected", "rejected", "REJECTED", true],
    ["refunded", "refunded", "REFUNDED", true],
    ["processed", "refunded", "REFUNDED", true],
    ["processed", "partially_refunded", "ERROR", false],
    ["charged_back", "settled", "ERROR", false],
    ["future_status", "future_detail", "ERROR", false],
  ] as const)("maps %s/%s to %s", (status, detail, expectedStatus, isFinal) => {
    expect(mapMercadoPagoOrderStatus(status, detail)).toEqual({
      status: expectedStatus,
      isFinal,
    });
  });

  it("normalizes provider status casing", () => {
    expect(mapMercadoPagoOrderStatus("PROCESSED", "ACCREDITED")).toEqual({
      status: "APPROVED",
      isFinal: true,
    });
  });
});

describe("MercadoPagoPaymentProvider requests", () => {
  it("creates a Checkout Pro order with the documented payload and headers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(providerOrder()), { status: 201 }),
    );
    const provider = createProvider(fetchMock);

    await expect(provider.createCheckout(checkoutInput())).resolves.toEqual({
      providerOrderId: "ORD-123",
      providerPaymentId: "456",
      externalReference: "order-local-123",
      status: "PENDING",
      statusDetail: "created",
      total: 12_990,
      currency: "CLP",
      checkoutUrl: "https://checkout.test/redirect/provider-order",
      isFinal: false,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.mercadopago.com/v1/orders");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer access-token-test");
    expect(headers.get("x-idempotency-key")).toBe("attempt-123");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      type: "online",
      processing_mode: "manual",
      external_reference: "order-local-123",
      description: "Pedido CH-00123",
      total_amount: "12990",
      expiration_time: "PT30M",
      payer: { email: "buyer@example.test" },
      items: [{
        id: "product-1",
        title: "Aceite de oliva",
        unit_price: "6495",
        quantity: 2,
        unit_measure: "unit",
        total_amount: "12990",
      }],
      config: {
        online: {
          success_url: "https://shop.test/checkout/success",
          failure_url: "https://shop.test/checkout/failure",
          pending_url: "https://shop.test/checkout/pending",
          auto_return: "approved",
        },
      },
    });
  });

  it("queries an encoded provider order id without an idempotency header", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(providerOrder({ status: "processed", status_detail: "accredited" }))),
    );

    await expect(createProvider(fetchMock).getOrder("ORD/123?source=test")).resolves.toMatchObject({
      status: "APPROVED",
      isFinal: true,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.mercadopago.com/v1/orders/ORD%2F123%3Fsource%3Dtest");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).has("x-idempotency-key")).toBe(false);
    expect(init).not.toHaveProperty("body");
  });

  it("sends a full refund without a body and reuses its idempotency key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(providerOrder({
        status: "refunded",
        status_detail: "refunded",
        transactions: { refunds: [{ id: "REF-123" }] },
      })), { status: 201 }),
    );

    await expect(createProvider(fetchMock).refundOrder({
      providerOrderId: "ORD-123",
      idempotencyKey: "refund-attempt-123",
    })).resolves.toEqual({
      providerRefundId: "REF-123",
      status: "APPROVED",
      statusDetail: "refunded",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.mercadopago.com/v1/orders/ORD-123/refund");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-idempotency-key")).toBe("refund-attempt-123");
    expect(headers.has("content-type")).toBe(false);
    expect(init).not.toHaveProperty("body");
  });
});

describe("MercadoPagoPaymentProvider webhook signatures", () => {
  const dataId = "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3";
  const requestId = "2066ca19-c6f1-498a-be75-1923005edd06";
  const timestamp = "1742505638683";

  it("accepts the exact Mercado Pago HMAC manifest", () => {
    const provider = createProvider(vi.fn<typeof fetch>());

    expect(provider.verifyWebhookSignature({
      dataId,
      requestId,
      signature: signedWebhook({ dataId, requestId, timestamp }),
    })).toBe(true);
  });

  it.each([
    "",
    "v1=abc",
    "ts=not-a-number,v1=abc",
    `ts=${timestamp},v1=not-a-sha256-hash`,
  ])("rejects malformed signature %j", (signature) => {
    expect(createProvider(vi.fn<typeof fetch>()).verifyWebhookSignature({
      dataId,
      requestId,
      signature,
    })).toBe(false);
  });

  it("rejects tampering with every signed manifest field", () => {
    const provider = createProvider(vi.fn<typeof fetch>());
    const signature = signedWebhook({ dataId, requestId, timestamp });

    expect(provider.verifyWebhookSignature({
      dataId: `${dataId}-tampered`,
      requestId,
      signature,
    })).toBe(false);
    expect(provider.verifyWebhookSignature({
      dataId,
      requestId: `${requestId}-tampered`,
      signature,
    })).toBe(false);
    expect(provider.verifyWebhookSignature({
      dataId,
      requestId,
      signature: signature.replace(timestamp, "1742505638684"),
    })).toBe(false);
  });
});
