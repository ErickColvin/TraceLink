import type { AppConfig } from "../../config/env.js";
import { FakePaymentProvider } from "./fake-payment-provider.js";
import { MercadoPagoPaymentProvider } from "./mercadopago-payment-provider.js";
import type { PaymentProvider } from "./payment-provider.js";

function required(value: string | undefined, name: string): string {
  if (value === undefined) throw new Error(`${name} is required for Mercado Pago.`);
  return value;
}

export function createPaymentProvider(config: AppConfig): PaymentProvider {
  if (config.paymentProvider === "fake") {
    return new FakePaymentProvider({
      checkoutBaseUrl: config.paymentPendingUrl,
      webhookSecret: config.mercadoPagoWebhookSecret ?? config.idempotencySecret,
    });
  }
  return new MercadoPagoPaymentProvider({
    accessToken: required(config.mercadoPagoAccessToken, "MERCADOPAGO_ACCESS_TOKEN"),
    webhookSecret: required(config.mercadoPagoWebhookSecret, "MERCADOPAGO_WEBHOOK_SECRET"),
    successUrl: config.paymentSuccessUrl,
    failureUrl: config.paymentFailureUrl,
    pendingUrl: config.paymentPendingUrl,
  });
}

