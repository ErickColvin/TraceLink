export const PAYMENT_LIFECYCLE_STATUSES = [
  "CREATED",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
  "ERROR",
] as const;

export type PaymentLifecycleStatus =
  (typeof PAYMENT_LIFECYCLE_STATUSES)[number];

export type PaymentCheckoutItem = Readonly<{
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}>;

export type CreateProviderCheckoutInput = Readonly<{
  attemptId: string;
  orderId: string;
  orderNumber: string;
  payerEmail: string;
  currency: "CLP";
  total: number;
  expiresAt: Date;
  items: readonly PaymentCheckoutItem[];
}>;

export type ProviderOrderSnapshot = Readonly<{
  providerOrderId: string;
  providerPaymentId?: string;
  externalReference: string;
  status: PaymentLifecycleStatus;
  statusDetail: string;
  total: number;
  currency: string;
  checkoutUrl?: string;
  providerRefundId?: string;
  isFinal: boolean;
}>;

export type ProviderRefundResult = Readonly<{
  providerRefundId?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ERROR";
  statusDetail: string;
}>;

export type WebhookSignatureInput = Readonly<{
  dataId: string;
  requestId: string;
  signature: string;
}>;

export interface PaymentProvider {
  readonly code: "FAKE" | "MERCADOPAGO";
  createCheckout(input: CreateProviderCheckoutInput): Promise<ProviderOrderSnapshot>;
  getOrder(providerOrderId: string): Promise<ProviderOrderSnapshot>;
  refundOrder(input: Readonly<{
    providerOrderId: string;
    idempotencyKey: string;
  }>): Promise<ProviderRefundResult>;
  verifyWebhookSignature(input: WebhookSignatureInput): boolean;
}

