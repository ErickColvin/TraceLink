import type { PostgresDatabase } from "../../database/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { PaymentProvider } from "./payment-provider.js";
import {
  PaymentReconciliationRepository,
  type ReconciliationResult,
} from "./payment-reconciliation.js";

export type PaymentWebhookInput = Readonly<{
  eventId: string;
  eventType: string;
  action: string;
  dataId: string;
  signature: string;
  providerRequestId: string;
  requestId: string;
  liveMode?: boolean;
  dateCreated?: string;
}>;

export class PaymentWebhookService {
  readonly #provider: PaymentProvider;
  readonly #repository: PaymentReconciliationRepository;

  constructor(database: PostgresDatabase, provider: PaymentProvider) {
    this.#provider = provider;
    this.#repository = new PaymentReconciliationRepository(database);
  }

  async process(input: PaymentWebhookInput): Promise<ReconciliationResult> {
    if (!this.#provider.verifyWebhookSignature({
      dataId: input.dataId,
      requestId: input.providerRequestId,
      signature: input.signature,
    })) {
      throw new AppError({
        statusCode: 401,
        code: "INVALID_WEBHOOK_SIGNATURE",
        message: "La firma del webhook no es válida.",
      });
    }
    const providerOrder = await this.#provider.getOrder(input.dataId);
    return this.#repository.reconcile({
      provider: this.#provider.code,
      source: "webhook",
      providerOrder,
      eventId: input.eventId,
      eventType: input.eventType,
      action: input.action,
      dataId: input.dataId,
      ...(input.liveMode === undefined ? {} : { liveMode: input.liveMode }),
      ...(input.dateCreated === undefined ? {} : { dateCreated: input.dateCreated }),
      requestId: input.requestId,
    });
  }
}
