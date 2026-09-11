import { createHash, randomUUID } from "node:crypto";

import type { PostgresDatabase } from "../../database/index.js";
import type { PaymentProvider } from "./payment-provider.js";
import { PaymentReconciliationRepository } from "./payment-reconciliation.js";

type ReconciliationCandidate = Readonly<{
  paymentId: string;
  providerOrderId: string;
}>;

export type PaymentReconciliationJobResult = Readonly<{
  selected: number;
  processed: number;
  unchanged: number;
  failed: number;
}>;

export type PaymentReconciliationFailure = Readonly<{
  paymentId: string;
  providerOrderId: string;
  requestId: string;
  error: unknown;
}>;

export class PaymentReconciliationJob {
  readonly #database: PostgresDatabase;
  readonly #provider: PaymentProvider;
  readonly #repository: PaymentReconciliationRepository;

  constructor(database: PostgresDatabase, provider: PaymentProvider) {
    this.#database = database;
    this.#provider = provider;
    this.#repository = new PaymentReconciliationRepository(database);
  }

  async run(options: Readonly<{
    limit: number;
    minAgeMinutes: number;
    maxAgeHours: number;
    onFailure?: (failure: PaymentReconciliationFailure) => void;
  }>): Promise<PaymentReconciliationJobResult> {
    const candidates = await this.#loadCandidates(options);
    let processed = 0;
    let unchanged = 0;
    let failed = 0;

    for (const candidate of candidates) {
      const requestId = `payment-reconciliation-job-${randomUUID()}`;
      try {
        const providerOrder = await this.#provider.getOrder(
          candidate.providerOrderId,
        );
        const statusFingerprint = createHash("sha256")
          .update([
            providerOrder.status,
            providerOrder.statusDetail,
            providerOrder.providerPaymentId ?? "",
            providerOrder.providerRefundId ?? "",
          ].join("\u0000"))
          .digest("hex")
          .slice(0, 32);
        const result = await this.#repository.reconcile({
          provider: this.#provider.code,
          source: "poll",
          providerOrder,
          eventId: `poll:${candidate.providerOrderId}:${statusFingerprint}`,
          eventType: "payment-reconciliation",
          action: "payment.reconciliation.poll",
          dataId: candidate.providerOrderId,
          requestId,
        });
        if (result.outcome === "processed") processed += 1;
        else unchanged += 1;
      } catch (error: unknown) {
        failed += 1;
        options.onFailure?.({ ...candidate, requestId, error });
      }
    }

    return {
      selected: candidates.length,
      processed,
      unchanged,
      failed,
    };
  }

  async #loadCandidates(options: Readonly<{
    limit: number;
    minAgeMinutes: number;
    maxAgeHours: number;
  }>): Promise<readonly ReconciliationCandidate[]> {
    const result = await this.#database.query<ReconciliationCandidate>(
      `WITH latest_attempt AS (
         SELECT DISTINCT ON (payment.id)
                payment.id AS "paymentId",
                attempt.provider_order_id AS "providerOrderId",
                COALESCE(payment.last_reconciled_at, payment.created_at) AS last_checked_at
           FROM payments payment
           JOIN orders ON orders.organization_id = payment.organization_id
            AND orders.id = payment.order_id
           JOIN payment_attempts attempt
             ON attempt.organization_id = payment.organization_id
            AND attempt.payment_id = payment.id
          WHERE payment.provider = $1
            AND payment.status IN ('CREATED', 'PENDING', 'ERROR')
            AND orders.status = 'PENDING_PAYMENT'
            AND attempt.status IN ('CREATED', 'PENDING', 'ERROR')
            AND attempt.provider_order_id IS NOT NULL
            AND attempt.created_at >= now() - ($2 * interval '1 hour')
          ORDER BY payment.id, attempt.created_at DESC
       )
       SELECT "paymentId", "providerOrderId"
         FROM latest_attempt
        WHERE last_checked_at <= now() - ($3 * interval '1 minute')
        ORDER BY last_checked_at ASC, "paymentId" ASC
        LIMIT $4`,
      [this.#provider.code, options.maxAgeHours, options.minAgeMinutes, options.limit],
    );
    return result.rows;
  }
}
