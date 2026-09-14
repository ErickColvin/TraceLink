import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  CreateProviderCheckoutInput,
  PaymentLifecycleStatus,
  PaymentProvider,
  ProviderOrderSnapshot,
  ProviderRefundResult,
  WebhookSignatureInput,
} from "./payment-provider.js";
import { PaymentProviderError } from "./payment-provider-error.js";

export type FakePaymentScenario =
  | "approved"
  | "pending"
  | "rejected"
  | "error";

type MutableFakeOrder = {
  providerOrderId: string;
  externalReference: string;
  status: PaymentLifecycleStatus;
  statusDetail: string;
  total: number;
  currency: string;
  checkoutUrl: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  isFinal: boolean;
};

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export class FakePaymentProvider implements PaymentProvider {
  readonly code = "FAKE" as const;
  readonly #orders = new Map<string, MutableFakeOrder>();
  readonly #byAttempt = new Map<string, string>();
  readonly #checkoutBaseUrl: string;
  readonly #webhookSecret: string;
  #scenario: FakePaymentScenario;

  constructor(options: Readonly<{
    checkoutBaseUrl: string;
    webhookSecret: string;
    scenario?: FakePaymentScenario;
  }>) {
    this.#checkoutBaseUrl = options.checkoutBaseUrl;
    this.#webhookSecret = options.webhookSecret;
    this.#scenario = options.scenario ?? "pending";
  }

  setScenario(scenario: FakePaymentScenario): void {
    this.#scenario = scenario;
  }

  setOrderStatus(providerOrderId: string, status: PaymentLifecycleStatus): void {
    const order = this.#orders.get(providerOrderId);
    if (order === undefined) throw new Error("Fake provider order does not exist.");
    order.status = status;
    order.statusDetail = status.toLowerCase();
    order.isFinal = ["APPROVED", "REJECTED", "CANCELLED", "REFUNDED"].includes(status);
    if (status === "APPROVED") order.providerPaymentId ??= `PAY-${providerOrderId}`;
  }

  createCheckout(input: CreateProviderCheckoutInput): Promise<ProviderOrderSnapshot> {
    if (this.#scenario === "error") {
      return Promise.reject(new PaymentProviderError({
        message: "El proveedor de pago simulado no está disponible.",
        retryable: true,
      }));
    }
    const existingId = this.#byAttempt.get(input.attemptId);
    if (existingId !== undefined) return this.getOrder(existingId);
    const providerOrderId = `FAKE-${input.attemptId}`;
    const status: PaymentLifecycleStatus = this.#scenario === "approved"
      ? "APPROVED"
      : this.#scenario === "rejected" ? "REJECTED" : "PENDING";
    const checkoutUrl = new URL(this.#checkoutBaseUrl);
    checkoutUrl.searchParams.set("provider_order_id", providerOrderId);
    checkoutUrl.searchParams.set("source", "fake");
    const order: MutableFakeOrder = {
      providerOrderId,
      externalReference: input.orderId,
      status,
      statusDetail: this.#scenario,
      total: input.total,
      currency: input.currency,
      checkoutUrl: checkoutUrl.toString(),
      ...(status === "APPROVED" ? { providerPaymentId: `PAY-${providerOrderId}` } : {}),
      isFinal: status !== "PENDING",
    };
    this.#orders.set(providerOrderId, order);
    this.#byAttempt.set(input.attemptId, providerOrderId);
    return Promise.resolve({ ...order });
  }

  getOrder(providerOrderId: string): Promise<ProviderOrderSnapshot> {
    const order = this.#orders.get(providerOrderId);
    if (order === undefined) {
      return Promise.reject(new PaymentProviderError({
        message: "La orden de pago simulada no existe.",
        retryable: false,
        statusCode: 404,
      }));
    }
    return Promise.resolve({ ...order });
  }

  refundOrder(input: Readonly<{
    providerOrderId: string;
    idempotencyKey: string;
  }>): Promise<ProviderRefundResult> {
    void input.idempotencyKey;
    const order = this.#orders.get(input.providerOrderId);
    if (order === undefined || order.status !== "APPROVED") {
      return Promise.resolve({ status: "REJECTED", statusDetail: "not_approved" });
    }
    order.status = "REFUNDED";
    order.statusDetail = "refunded";
    order.isFinal = true;
    order.providerRefundId ??= `REF-${order.providerOrderId}`;
    return Promise.resolve({
      providerRefundId: order.providerRefundId,
      status: "APPROVED",
      statusDetail: "refunded",
    });
  }

  verifyWebhookSignature(input: WebhookSignatureInput): boolean {
    const expected = createHmac("sha256", this.#webhookSecret)
      .update(`${input.dataId}:${input.requestId}`)
      .digest("hex");
    return secureEquals(expected, input.signature);
  }

  signWebhook(dataId: string, requestId: string): string {
    return createHmac("sha256", this.#webhookSecret)
      .update(`${dataId}:${requestId}`)
      .digest("hex");
  }
}

