import type { PostgresDatabase } from "../../database/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { PaymentProvider } from "../payments/payment-provider.js";
import { PaymentProviderError } from "../payments/payment-provider-error.js";
import {
  CheckoutRepository,
  type CheckoutCommand,
  type CheckoutResult,
} from "./checkout-repository.js";

export class CheckoutService {
  readonly #repository: CheckoutRepository;
  readonly #provider: PaymentProvider;
  readonly #reservationMinutes: number;

  constructor(options: Readonly<{
    database: PostgresDatabase;
    idempotencySecret: string;
    provider: PaymentProvider;
    reservationMinutes: number;
  }>) {
    this.#repository = new CheckoutRepository(options.database, options.idempotencySecret);
    this.#provider = options.provider;
    this.#reservationMinutes = options.reservationMinutes;
  }

  async checkout(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    input: CheckoutCommand;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<Readonly<{ body: CheckoutResult; replayed: boolean }>> {
    const prepared = await this.#repository.prepare({
      ...options,
      provider: this.#provider.code,
      reservationMinutes: this.#reservationMinutes,
    });
    if (prepared.replay !== null) {
      return { body: prepared.replay, replayed: true };
    }
    try {
      const providerOrder = await this.#provider.createCheckout({
        attemptId: prepared.attemptId,
        orderId: prepared.orderId,
        orderNumber: prepared.orderNumber,
        payerEmail: prepared.payerEmail,
        currency: "CLP",
        total: prepared.total,
        expiresAt: prepared.expiresAt,
        items: prepared.products.map((product) => ({
          productId: product.id,
          title: product.name,
          quantity: product.quantity,
          unitPrice: product.salePrice,
          lineTotal: product.lineTotal,
        })),
      });
      return {
        body: await this.#repository.finalize({
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          requestId: options.requestId,
          prepared,
          providerOrder,
        }),
        replayed: false,
      };
    } catch (error: unknown) {
      await this.#repository.markProviderError({
        organizationId: options.organizationId,
        prepared,
        requestId: options.requestId,
      });
      if (error instanceof AppError) throw error;
      throw new AppError({
        statusCode: 503,
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
        message: "El proveedor de pago no está disponible. Puedes reintentar con la misma clave.",
        cause: error instanceof PaymentProviderError ? error : undefined,
      });
    }
  }
}

