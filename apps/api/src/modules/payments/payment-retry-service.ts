import type { PostgresDatabase } from "../../database/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import { CheckoutRepository, type CheckoutResult } from "../checkout/checkout-repository.js";
import type { PaymentProvider } from "./payment-provider.js";
import { PaymentRetryRepository } from "./payment-retry-repository.js";

export class PaymentRetryService {
  readonly #retryRepository: PaymentRetryRepository;
  readonly #checkoutRepository: CheckoutRepository;
  readonly #provider: PaymentProvider;
  readonly #reservationMinutes: number;

  constructor(options: Readonly<{
    database: PostgresDatabase;
    idempotencySecret: string;
    provider: PaymentProvider;
    reservationMinutes: number;
  }>) {
    this.#retryRepository = new PaymentRetryRepository(options.database, options.idempotencySecret);
    this.#checkoutRepository = new CheckoutRepository(options.database, options.idempotencySecret);
    this.#provider = options.provider;
    this.#reservationMinutes = options.reservationMinutes;
  }

  async retry(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    orderId: string;
    idempotencyKey: string;
    requestId: string;
  }>): Promise<Readonly<{ body: CheckoutResult; replayed: boolean }>> {
    const prepared = await this.#retryRepository.prepare({
      ...options,
      reservationMinutes: this.#reservationMinutes,
    });
    if (prepared.replay !== null) return { body: prepared.replay, replayed: true };
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
        body: await this.#checkoutRepository.finalize({
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          requestId: options.requestId,
          prepared,
          providerOrder,
        }),
        replayed: false,
      };
    } catch (error: unknown) {
      await this.#checkoutRepository.markProviderError({
        organizationId: options.organizationId,
        prepared,
        requestId: options.requestId,
      });
      if (error instanceof AppError) throw error;
      throw new AppError({
        statusCode: 503,
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
        message: "El proveedor de pago no está disponible. Reintenta con la misma clave.",
        cause: error,
      });
    }
  }
}

