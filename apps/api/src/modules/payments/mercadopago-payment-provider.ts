import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type {
  CreateProviderCheckoutInput,
  PaymentLifecycleStatus,
  PaymentProvider,
  ProviderOrderSnapshot,
  ProviderRefundResult,
  WebhookSignatureInput,
} from "./payment-provider.js";
import { fetchProviderJson } from "./provider-http.js";

const API_BASE_URL = "https://api.mercadopago.com";

const transactionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).optional(),
}).passthrough();

const mercadoPagoOrderSchema = z.object({
  id: z.string().min(1),
  external_reference: z.string().min(1),
  status: z.string().min(1),
  status_detail: z.string().default("unknown"),
  total_amount: z.union([z.string(), z.number()]),
  currency: z.string().min(1).default("CLP"),
  checkout_url: z.string().url().optional(),
  transactions: z.object({
    payments: z.array(transactionSchema).optional(),
    refunds: z.array(transactionSchema).optional(),
  }).passthrough().optional(),
}).passthrough();

function parseClpAmount(value: string | number): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Mercado Pago devolvió un monto CLP inválido.");
  }
  return amount;
}

export function mapMercadoPagoOrderStatus(
  status: string,
  detail: string,
): Readonly<{ status: PaymentLifecycleStatus; isFinal: boolean }> {
  const normalizedStatus = status.toLowerCase();
  const normalizedDetail = detail.toLowerCase();
  if (normalizedStatus === "refunded" || normalizedDetail === "refunded") {
    return { status: "REFUNDED", isFinal: true };
  }
  if (normalizedStatus === "processed" && normalizedDetail === "accredited") {
    return { status: "APPROVED", isFinal: true };
  }
  if (["canceled", "cancelled", "expired"].includes(normalizedStatus)) {
    return { status: "CANCELLED", isFinal: true };
  }
  if (["rejected", "failed"].includes(normalizedStatus)) {
    return { status: "REJECTED", isFinal: true };
  }
  if (["created", "processing", "action_required"].includes(normalizedStatus)) {
    return { status: "PENDING", isFinal: false };
  }
  return { status: "ERROR", isFinal: false };
}

function toSnapshot(payload: unknown): ProviderOrderSnapshot {
  const order = mercadoPagoOrderSchema.parse(payload);
  const mapped = mapMercadoPagoOrderStatus(order.status, order.status_detail);
  const providerPaymentId = order.transactions?.payments?.[0]?.id;
  const providerRefundId = order.transactions?.refunds?.[0]?.id;
  return {
    providerOrderId: order.id,
    ...(providerPaymentId === undefined ? {} : { providerPaymentId }),
    externalReference: order.external_reference,
    status: mapped.status,
    statusDetail: order.status_detail,
    total: parseClpAmount(order.total_amount),
    currency: order.currency,
    ...(order.checkout_url === undefined ? {} : { checkoutUrl: order.checkout_url }),
    ...(providerRefundId === undefined ? {} : { providerRefundId }),
    isFinal: mapped.isFinal,
  };
}

function parseSignature(signature: string): Readonly<{ ts: string; hashes: readonly string[] }> | null {
  const fields = signature.split(",").map((part) => part.trim().split("=", 2));
  const ts = fields.find(([key]) => key === "ts")?.[1];
  const hashes = fields.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (ts === undefined || hashes.length === 0 || !/^\d+$/u.test(ts)) return null;
  return { ts, hashes };
}

function secureHexEquals(expected: string, supplied: string): boolean {
  if (!/^[a-f\d]{64}$/iu.test(supplied)) return false;
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(supplied, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly code = "MERCADOPAGO" as const;
  readonly #accessToken: string;
  readonly #webhookSecret: string;
  readonly #successUrl: string;
  readonly #failureUrl: string;
  readonly #pendingUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: Readonly<{
    accessToken: string;
    webhookSecret: string;
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
    fetchImplementation?: typeof fetch;
  }>) {
    this.#accessToken = options.accessToken;
    this.#webhookSecret = options.webhookSecret;
    this.#successUrl = options.successUrl;
    this.#failureUrl = options.failureUrl;
    this.#pendingUrl = options.pendingUrl;
    this.#fetch = options.fetchImplementation ?? globalThis.fetch;
  }

  async createCheckout(input: CreateProviderCheckoutInput): Promise<ProviderOrderSnapshot> {
    const payload = await fetchProviderJson({
      url: `${API_BASE_URL}/v1/orders`,
      accessToken: this.#accessToken,
      method: "POST",
      idempotencyKey: input.attemptId,
      fetchImplementation: this.#fetch,
      body: {
        type: "online",
        processing_mode: "manual",
        external_reference: input.orderId,
        description: `Pedido ${input.orderNumber}`,
        total_amount: String(input.total),
        expiration_time: `PT${Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 60_000))}M`,
        payer: { email: input.payerEmail },
        items: input.items.map((item) => ({
          id: item.productId,
          title: item.title,
          unit_price: String(item.unitPrice),
          quantity: item.quantity,
          unit_measure: "unit",
          total_amount: String(item.lineTotal),
        })),
        config: {
          online: {
            success_url: this.#successUrl,
            failure_url: this.#failureUrl,
            pending_url: this.#pendingUrl,
            auto_return: "approved",
          },
        },
      },
    });
    return toSnapshot(payload);
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrderSnapshot> {
    return toSnapshot(await fetchProviderJson({
      url: `${API_BASE_URL}/v1/orders/${encodeURIComponent(providerOrderId)}`,
      accessToken: this.#accessToken,
      fetchImplementation: this.#fetch,
    }));
  }

  async refundOrder(input: Readonly<{
    providerOrderId: string;
    idempotencyKey: string;
  }>): Promise<ProviderRefundResult> {
    const snapshot = toSnapshot(await fetchProviderJson({
      url: `${API_BASE_URL}/v1/orders/${encodeURIComponent(input.providerOrderId)}/refund`,
      accessToken: this.#accessToken,
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      fetchImplementation: this.#fetch,
    }));
    return {
      ...(snapshot.providerRefundId === undefined
        ? {}
        : { providerRefundId: snapshot.providerRefundId }),
      status: snapshot.status === "REFUNDED" ? "APPROVED" :
        snapshot.status === "PENDING" ? "PENDING" :
        snapshot.status === "REJECTED" || snapshot.status === "CANCELLED"
          ? "REJECTED"
          : "ERROR",
      statusDetail: snapshot.statusDetail,
    };
  }

  verifyWebhookSignature(input: WebhookSignatureInput): boolean {
    const parsed = parseSignature(input.signature);
    if (parsed === null) return false;
    const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${parsed.ts};`;
    const expected = createHmac("sha256", this.#webhookSecret)
      .update(manifest)
      .digest("hex");
    return parsed.hashes.some((hash) => secureHexEquals(expected, hash));
  }
}
