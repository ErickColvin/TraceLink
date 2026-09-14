import type {
  CreateFullRefundRequest,
  FullRefundResponse,
  Payment,
  Refund,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { hmacSha256, secureBufferEquals, stableJson } from "../../shared/security/fingerprint.js";
import type { PaymentProvider } from "./payment-provider.js";
import { enqueueNotification } from "../notifications/notification-outbox.js";

type RefundContext = Readonly<{
  organizationId: string;
  orderId: string;
  orderStatus: string;
  paymentId: string;
  paymentStatus: string;
  provider: "FAKE" | "MERCADOPAGO";
  providerOrderId: string;
  amount: number;
  refundId: string;
  orderNumber: string;
  customerEmail: string;
  customerFirstName: string;
}>;

type IdempotencyRow = Readonly<{
  requestHash: Buffer;
  status: "IN_PROGRESS" | "COMPLETED";
  responseJson: unknown | null;
  resourceId: string | null;
}>;

type PaymentRow = Readonly<{
  id: string;
  orderId: string;
  provider: Payment["provider"];
  status: Payment["status"];
  amount: number;
  currency: string;
  providerExternalReference: string;
  providerPaymentId: string | null;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  approvedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  lastReconciledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type RefundRow = Readonly<{
  id: string;
  paymentId: string;
  status: Refund["status"];
  amount: number;
  reason: string;
  requestedByUserId: string | null;
  providerRefundId: string | null;
  requestedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    providerExternalReference: row.providerExternalReference,
    ...(row.providerPaymentId === null ? {} : { providerPaymentId: row.providerPaymentId }),
    ...(row.providerStatus === null ? {} : { providerStatus: row.providerStatus }),
    ...(row.providerStatusDetail === null ? {} : { providerStatusDetail: row.providerStatusDetail }),
    ...(row.approvedAt === null ? {} : { approvedAt: row.approvedAt.toISOString() }),
    ...(row.cancelledAt === null ? {} : { cancelledAt: row.cancelledAt.toISOString() }),
    ...(row.refundedAt === null ? {} : { refundedAt: row.refundedAt.toISOString() }),
    ...(row.lastReconciledAt === null ? {} : { lastReconciledAt: row.lastReconciledAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    paymentId: row.paymentId,
    status: row.status,
    amount: row.amount,
    reason: row.reason,
    ...(row.requestedByUserId === null ? {} : { requestedByUserId: row.requestedByUserId }),
    ...(row.providerRefundId === null ? {} : { providerRefundId: row.providerRefundId }),
    requestedAt: row.requestedAt.toISOString(),
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadRefundResponse(
  executor: SqlExecutor,
  organizationId: string,
  refundId: string,
): Promise<FullRefundResponse> {
  const payment = await executor.query<PaymentRow>(
    `SELECT payment.id, payment.order_id AS "orderId", payment.provider,
            payment.status, payment.amount, payment.currency,
            payment.provider_external_reference AS "providerExternalReference",
            payment.provider_payment_id AS "providerPaymentId",
            payment.provider_status AS "providerStatus",
            payment.provider_status_detail AS "providerStatusDetail",
            payment.approved_at AS "approvedAt", payment.cancelled_at AS "cancelledAt",
            payment.refunded_at AS "refundedAt",
            payment.last_reconciled_at AS "lastReconciledAt",
            payment.created_at AS "createdAt", payment.updated_at AS "updatedAt"
       FROM payments payment
       JOIN refunds refund ON refund.organization_id = payment.organization_id
        AND refund.payment_id = payment.id
      WHERE refund.organization_id = $1 AND refund.id = $2`,
    [organizationId, refundId],
  );
  const refund = await executor.query<RefundRow>(
    `SELECT id, payment_id AS "paymentId", status, amount, reason,
            actor_user_id AS "requestedByUserId", provider_refund_id AS "providerRefundId",
            requested_at AS "requestedAt", completed_at AS "completedAt",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM refunds WHERE organization_id = $1 AND id = $2`,
    [organizationId, refundId],
  );
  const paymentRow = payment.rows[0];
  const refundRow = refund.rows[0];
  if (paymentRow === undefined || refundRow === undefined) throw new Error("Refund response missing.");
  return { payment: toPayment(paymentRow), refund: toRefund(refundRow) };
}

export class RefundService {
  readonly #database: PostgresDatabase;
  readonly #provider: PaymentProvider;
  readonly #idempotencySecret: string;

  constructor(options: Readonly<{
    database: PostgresDatabase;
    provider: PaymentProvider;
    idempotencySecret: string;
  }>) {
    this.#database = options.database;
    this.#provider = options.provider;
    this.#idempotencySecret = options.idempotencySecret;
  }

  async refund(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    orderId: string;
    input: CreateFullRefundRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<Readonly<{ body: FullRefundResponse; replayed: boolean }>> {
    const prepared = await this.#prepare(options);
    if (prepared.replay !== null) return { body: prepared.replay, replayed: true };
    let providerResult;
    try {
      providerResult = await this.#provider.refundOrder({
        providerOrderId: prepared.context.providerOrderId,
        idempotencyKey: prepared.context.refundId,
      });
    } catch (error: unknown) {
      await this.#markError(prepared.context, options.requestId);
      throw new AppError({
        statusCode: 503,
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
        message: "No se pudo confirmar el reembolso. Reintenta con la misma clave.",
        cause: error,
      });
    }
    const body = await this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        `UPDATE refunds SET status = $3, provider_refund_id = COALESCE($4, provider_refund_id),
                completed_at = CASE WHEN $3 IN ('APPROVED','REJECTED') THEN now() ELSE completed_at END,
                updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [
          options.organizationId,
          prepared.context.refundId,
          providerResult.status,
          providerResult.providerRefundId ?? null,
        ],
      );
      if (providerResult.status === "APPROVED") {
        await executor.query(
          `UPDATE payments SET status = 'REFUNDED', provider_status = 'REFUNDED',
                  provider_status_detail = $3, refunded_at = COALESCE(refunded_at, now()),
                  last_reconciled_at = now(), updated_at = now()
            WHERE organization_id = $1 AND id = $2`,
          [options.organizationId, prepared.context.paymentId, providerResult.statusDetail],
        );
        const updated = await executor.query(
          `UPDATE orders SET status = 'REFUNDED', payment_status = 'REFUNDED', updated_at = now()
            WHERE organization_id = $1 AND id = $2 AND status <> 'REFUNDED'`,
          [options.organizationId, options.orderId],
        );
        if ((updated.rowCount ?? 0) > 0) {
          await executor.query(
            `INSERT INTO order_status_events
               (organization_id, order_id, from_status, to_status, actor_user_id,
                reason, occurred_at)
             VALUES ($1, $2, $3, 'REFUNDED', $4, $5, now())`,
            [
              options.organizationId,
              options.orderId,
              prepared.context.orderStatus,
              options.actorUserId,
              options.input.reason,
            ],
          );
          await enqueueNotification(executor, {
            organizationId: options.organizationId,
            eventKey: `order.refunded:${prepared.context.paymentId}`,
            eventType: "order.refunded",
            recipientEmail: prepared.context.customerEmail,
            payload: {
              firstName: prepared.context.customerFirstName,
              orderNumber: prepared.context.orderNumber,
              total: prepared.context.amount,
            },
          });
        }
      }
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "payment.refund",
        entityType: "Refund",
        entityId: prepared.context.refundId,
        after: {
          status: providerResult.status,
          amount: prepared.context.amount,
          providerRefundId: providerResult.providerRefundId,
          reason: options.input.reason,
        },
        requestId: options.requestId,
      });
      const response = await loadRefundResponse(executor, options.organizationId, prepared.context.refundId);
      await executor.query(
        `UPDATE idempotency_records SET status = 'COMPLETED', response_status = 200,
                response_json = $4::jsonb
          WHERE organization_id = $1 AND actor_user_id = $2 AND key_hash = $3`,
        [options.organizationId, options.actorUserId, prepared.keyHash, JSON.stringify(response)],
      );
      return response;
    });
    return { body, replayed: false };
  }

  async #prepare(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    orderId: string;
    input: CreateFullRefundRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<Readonly<{
    replay: FullRefundResponse | null;
    keyHash: Buffer;
    context: RefundContext;
  }>> {
    const keyHash = hmacSha256(
      this.#idempotencySecret,
      "idempotency-key",
      `${options.organizationId}\0${options.actorUserId}\0${options.idempotencyKey}`,
    );
    const requestHash = hmacSha256(
      this.#idempotencySecret,
      "idempotency-request",
      stableJson({ operation: "payment.refund", payload: { orderId: options.orderId, ...options.input } }),
    );
    return this.#database.sqlTransaction(async (executor) => {
      const inserted = await executor.query(
        `INSERT INTO idempotency_records
           (organization_id, actor_user_id, key_hash, request_hash, operation,
            status, original_request_id, expires_at)
         VALUES ($1, $2, $3, $4, 'payment.refund', 'IN_PROGRESS', $5,
                 now() + interval '24 hours')
         ON CONFLICT (organization_id, actor_user_id, key_hash) DO NOTHING`,
        [options.organizationId, options.actorUserId, keyHash, requestHash, options.requestId],
      );
      if (inserted.rowCount === 0) {
        const existing = await executor.query<IdempotencyRow>(
          `SELECT request_hash AS "requestHash", status,
                  response_json AS "responseJson", resource_id AS "resourceId"
             FROM idempotency_records
            WHERE organization_id = $1 AND actor_user_id = $2 AND key_hash = $3
            FOR UPDATE`,
          [options.organizationId, options.actorUserId, keyHash],
        );
        const row = existing.rows[0];
        if (row === undefined || !secureBufferEquals(row.requestHash, requestHash)) {
          throw new AppError({ statusCode: 409, code: "IDEMPOTENCY_CONFLICT", message: "La clave ya fue usada con otra solicitud." });
        }
        if (row.status === "COMPLETED") {
          if (row.responseJson === null) throw new Error("Completed refund has no response.");
          return { replay: row.responseJson as FullRefundResponse, keyHash, context: await this.#loadContext(executor, options.organizationId, row.resourceId) };
        }
        return { replay: null, keyHash, context: await this.#loadContext(executor, options.organizationId, row.resourceId) };
      }
      const payment = await executor.query<Omit<RefundContext, "refundId">>(
        `SELECT payment.organization_id AS "organizationId", orders.id AS "orderId",
                orders.status AS "orderStatus", payment.id AS "paymentId",
                payment.status AS "paymentStatus", payment.provider,
                attempt.provider_order_id AS "providerOrderId", payment.amount,
                orders.order_number AS "orderNumber", customer.email AS "customerEmail",
                customer.first_name AS "customerFirstName"
           FROM orders
           JOIN customers customer ON customer.organization_id = orders.organization_id
            AND customer.id = orders.customer_id
           JOIN payments payment ON payment.organization_id = orders.organization_id
            AND payment.order_id = orders.id
           JOIN LATERAL (
             SELECT provider_order_id FROM payment_attempts
              WHERE organization_id = payment.organization_id AND payment_id = payment.id
                AND provider_order_id IS NOT NULL
              ORDER BY attempt_number DESC LIMIT 1
           ) attempt ON true
          WHERE orders.organization_id = $1 AND orders.id = $2
          FOR UPDATE OF orders, payment`,
        [options.organizationId, options.orderId],
      );
      const context = payment.rows[0];
      if (context === undefined) {
        throw new AppError({ statusCode: 404, code: "NOT_FOUND", message: "No se encontró el pago del pedido." });
      }
      if (context.paymentStatus !== "APPROVED" || ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(context.orderStatus)) {
        throw new AppError({
          statusCode: 409,
          code: "REFUND_NOT_ALLOWED",
          message: "Solo se puede reembolsar un pago aprobado que aún no fue reembolsado.",
        });
      }
      const refund = await executor.query<Readonly<{ id: string }>>(
        `INSERT INTO refunds
           (organization_id, payment_id, amount, reason, actor_user_id, status,
            requested_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', now(), now()) RETURNING id`,
        [options.organizationId, context.paymentId, context.amount, options.input.reason, options.actorUserId],
      );
      const refundId = refund.rows[0]?.id;
      if (refundId === undefined) throw new Error("Refund insert returned no row.");
      await executor.query(
        `UPDATE idempotency_records SET resource_type = 'Refund', resource_id = $4
          WHERE organization_id = $1 AND actor_user_id = $2 AND key_hash = $3`,
        [options.organizationId, options.actorUserId, keyHash, refundId],
      );
      return { replay: null, keyHash, context: { ...context, refundId } };
    });
  }

  async #loadContext(
    executor: SqlExecutor,
    organizationId: string,
    refundId: string | null,
  ): Promise<RefundContext> {
    if (refundId === null) throw new AppError({ statusCode: 409, code: "CONFLICT", message: "El reembolso todavía se está preparando." });
    const result = await executor.query<RefundContext>(
      `SELECT refund.organization_id AS "organizationId", orders.id AS "orderId",
              orders.status AS "orderStatus", payment.id AS "paymentId",
              payment.status AS "paymentStatus", payment.provider,
              attempt.provider_order_id AS "providerOrderId", payment.amount,
              orders.order_number AS "orderNumber", customer.email AS "customerEmail",
              customer.first_name AS "customerFirstName",
              refund.id AS "refundId"
         FROM refunds refund
         JOIN payments payment ON payment.organization_id = refund.organization_id
          AND payment.id = refund.payment_id
         JOIN orders ON orders.organization_id = payment.organization_id
          AND orders.id = payment.order_id
         JOIN customers customer ON customer.organization_id = orders.organization_id
          AND customer.id = orders.customer_id
         JOIN LATERAL (
           SELECT provider_order_id FROM payment_attempts
            WHERE organization_id = payment.organization_id AND payment_id = payment.id
              AND provider_order_id IS NOT NULL
            ORDER BY attempt_number DESC LIMIT 1
         ) attempt ON true
        WHERE refund.organization_id = $1 AND refund.id = $2`,
      [organizationId, refundId],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Refund context could not be restored.");
    return row;
  }

  async #markError(context: RefundContext, requestId: string): Promise<void> {
    await this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        `UPDATE refunds SET status = 'ERROR', updated_at = now()
          WHERE organization_id = $1 AND id = $2 AND status <> 'APPROVED'`,
        [context.organizationId, context.refundId],
      );
      await writeAudit(executor, {
        organizationId: context.organizationId,
        action: "payment.refund.provider-error",
        entityType: "Refund",
        entityId: context.refundId,
        after: { status: "ERROR" },
        requestId,
      });
    });
  }
}
