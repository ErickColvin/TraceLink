import { describe, expect, it } from "vitest";

import { FakePaymentProvider } from "../../src/modules/payments/fake-payment-provider.js";
import type { CreateProviderCheckoutInput } from "../../src/modules/payments/payment-provider.js";
import { PaymentProviderError } from "../../src/modules/payments/payment-provider-error.js";

function checkoutInput(
  overrides: Partial<CreateProviderCheckoutInput> = {},
): CreateProviderCheckoutInput {
  return {
    attemptId: "attempt-123",
    orderId: "order-local-123",
    orderNumber: "CH-00123",
    payerEmail: "buyer@example.test",
    currency: "CLP",
    total: 12_990,
    expiresAt: new Date("2026-09-08T12:30:00.000Z"),
    items: [{
      productId: "product-1",
      title: "Aceite de oliva",
      quantity: 1,
      unitPrice: 12_990,
      lineTotal: 12_990,
    }],
    ...overrides,
  };
}

function createProvider(
  scenario: "approved" | "pending" | "rejected" | "error" = "pending",
): FakePaymentProvider {
  return new FakePaymentProvider({
    checkoutBaseUrl: "https://shop.test/checkout/fake",
    webhookSecret: "fake-webhook-secret-for-tests",
    scenario,
  });
}

describe("FakePaymentProvider", () => {
  it.each([
    ["approved", "APPROVED", true, true],
    ["pending", "PENDING", false, false],
    ["rejected", "REJECTED", true, false],
  ] as const)("creates the %s scenario", async (
    scenario,
    expectedStatus,
    isFinal,
    hasPaymentId,
  ) => {
    const snapshot = await createProvider(scenario).createCheckout(checkoutInput());

    expect(snapshot).toMatchObject({
      providerOrderId: "FAKE-attempt-123",
      externalReference: "order-local-123",
      status: expectedStatus,
      statusDetail: scenario,
      total: 12_990,
      currency: "CLP",
      isFinal,
    });
    expect(snapshot.checkoutUrl).toBe(
      "https://shop.test/checkout/fake?provider_order_id=FAKE-attempt-123&source=fake",
    );
    expect(snapshot.providerPaymentId !== undefined).toBe(hasPaymentId);
  });

  it("raises a retryable provider error in error mode", async () => {
    const error = await createProvider("error")
      .createCheckout(checkoutInput())
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(PaymentProviderError);
    expect(error).toMatchObject({ retryable: true, statusCode: undefined });
  });

  it("replays a duplicate create attempt without replacing its original order", async () => {
    const provider = createProvider("pending");
    const original = await provider.createCheckout(checkoutInput());
    provider.setScenario("approved");

    const replay = await provider.createCheckout(checkoutInput({
      orderId: "different-order",
      total: 99_999,
    }));

    expect(replay).toEqual(original);
    expect(replay.externalReference).toBe("order-local-123");
    expect(replay.total).toBe(12_990);
  });

  it("queries current state and returns a non-retryable 404 for unknown orders", async () => {
    const provider = createProvider();
    const created = await provider.createCheckout(checkoutInput());
    provider.setOrderStatus(created.providerOrderId, "APPROVED");

    await expect(provider.getOrder(created.providerOrderId)).resolves.toMatchObject({
      status: "APPROVED",
      statusDetail: "approved",
      providerPaymentId: "PAY-FAKE-attempt-123",
      isFinal: true,
    });
    await expect(provider.getOrder("FAKE-unknown")).rejects.toMatchObject({
      retryable: false,
      statusCode: 404,
    });
  });

  it("refunds an approved order and exposes the resulting snapshot", async () => {
    const provider = createProvider("approved");
    const order = await provider.createCheckout(checkoutInput());

    await expect(provider.refundOrder({
      providerOrderId: order.providerOrderId,
      idempotencyKey: "refund-attempt-123",
    })).resolves.toEqual({
      providerRefundId: "REF-FAKE-attempt-123",
      status: "APPROVED",
      statusDetail: "refunded",
    });
    await expect(provider.getOrder(order.providerOrderId)).resolves.toMatchObject({
      status: "REFUNDED",
      statusDetail: "refunded",
      providerRefundId: "REF-FAKE-attempt-123",
      isFinal: true,
    });
  });

  it("rejects refunds for pending, already-refunded and unknown orders", async () => {
    const pendingProvider = createProvider("pending");
    const pendingOrder = await pendingProvider.createCheckout(checkoutInput());
    await expect(pendingProvider.refundOrder({
      providerOrderId: pendingOrder.providerOrderId,
      idempotencyKey: "refund-pending",
    })).resolves.toEqual({ status: "REJECTED", statusDetail: "not_approved" });

    const approvedProvider = createProvider("approved");
    const approvedOrder = await approvedProvider.createCheckout(checkoutInput());
    await approvedProvider.refundOrder({
      providerOrderId: approvedOrder.providerOrderId,
      idempotencyKey: "refund-first",
    });
    await expect(approvedProvider.refundOrder({
      providerOrderId: approvedOrder.providerOrderId,
      idempotencyKey: "refund-duplicate",
    })).resolves.toEqual({ status: "REJECTED", statusDetail: "not_approved" });

    await expect(approvedProvider.refundOrder({
      providerOrderId: "FAKE-unknown",
      idempotencyKey: "refund-unknown",
    })).resolves.toEqual({ status: "REJECTED", statusDetail: "not_approved" });
  });

  it("signs and validates fake webhook notifications", () => {
    const provider = createProvider();
    const signature = provider.signWebhook("FAKE-attempt-123", "request-123");

    expect(provider.verifyWebhookSignature({
      dataId: "FAKE-attempt-123",
      requestId: "request-123",
      signature,
    })).toBe(true);
    expect(provider.verifyWebhookSignature({
      dataId: "FAKE-attempt-123-tampered",
      requestId: "request-123",
      signature,
    })).toBe(false);
  });
});
