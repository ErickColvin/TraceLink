import { createHash } from "node:crypto";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { enqueueNotification } from "../notifications/notification-outbox.js";
import {
  commitOrderReservations,
  releaseOrderReservations,
} from "../inventory/order-reservations.js";
import type { ProviderOrderSnapshot } from "./payment-provider.js";

type PaymentContext = Readonly<{
  organizationId: string;
  paymentId: string;
  attemptId: string;
  orderId: string;
  orderStatus: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  orderNumber: string;
  customerEmail: string;
  customerFirstName: string;
}>;

export type ReconciliationResult = Readonly<{
  duplicate: boolean;
  outcome: "processed" | "ignored";
}>;

async function loadPaymentContext(
  executor: SqlExecutor,
  providerOrderId: string,
): Promise<PaymentContext | null> {
  const result = await executor.query<PaymentContext>(
    `SELECT payment.organization_id AS "organizationId",
            payment.id AS "paymentId", attempt.id AS "attemptId",
            orders.id AS "orderId", orders.status AS "orderStatus",
            payment.status AS "paymentStatus", payment.amount, payment.currency,
            orders.order_number AS "orderNumber", customer.email AS "customerEmail",
            customer.first_name AS "customerFirstName"
       FROM payment_attempts attempt
       JOIN payments payment
         ON payment.organization_id = attempt.organization_id
        AND payment.id = attempt.payment_id
       JOIN orders ON orders.organization_id = payment.organization_id
        AND orders.id = payment.order_id
       JOIN customers customer ON customer.organization_id = orders.organization_id
        AND customer.id = orders.customer_id
      WHERE attempt.provider_order_id = $1
      ORDER BY attempt.created_at DESC LIMIT 1
      FOR UPDATE OF payment, attempt, orders`,
    [providerOrderId],
  );
  return result.rows[0] ?? null;
}

function sanitizedEventPayload(input: Readonly<{
  eventId: string;
  eventType: string;
  action: string;
  dataId: string;
  liveMode?: boolean;
  dateCreated?: string;
}>): Readonly<Record<string, unknown>> {
  return {
    id: input.eventId,
    type: input.eventType,
    action: input.action,
    data: { id: input.dataId },
    ...(input.liveMode === undefined ? {} : { liveMode: input.liveMode }),
    ...(input.dateCreated === undefined ? {} : { dateCreated: input.dateCreated }),
  };
}

export class PaymentReconciliationRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  reconcile(options: Readonly<{
    provider: "FAKE" | "MERCADOPAGO";
    source: "webhook" | "poll";
    providerOrder: ProviderOrderSnapshot;
    eventId: string;
    eventType: string;
    action: string;
    dataId: string;
    liveMode?: boolean;
    dateCreated?: string;
    requestId: string;
  }>): Promise<ReconciliationResult> {
    return this.#database.sqlTransaction(async (executor) => {
      const context = await loadPaymentContext(executor, options.providerOrder.providerOrderId);
      if (context === null) return { duplicate: false, outcome: "ignored" };
      if (
        options.providerOrder.externalReference !== context.orderId ||
        options.providerOrder.total !== context.amount ||
        options.providerOrder.currency !== context.currency
      ) {
        throw new AppError({
          statusCode: 409,
          code: "PAYMENT_PROVIDER_MISMATCH",
          message: "El recurso del proveedor no coincide con el pago local.",
        });
      }
      const sanitized = sanitizedEventPayload(options);
      const payloadJson = JSON.stringify(sanitized);
      const payloadHash = createHash("sha256").update(payloadJson).digest();
      const event = await executor.query(
        `INSERT INTO payment_provider_events
           (organization_id, payment_id, provider, provider_event_id, event_type,
            provider_resource_id, sanitized_payload, payload_hash, processed,
            processing_attempts, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, false, 1, now())
         ON CONFLICT (provider, provider_event_id) DO NOTHING`,
        [
          context.organizationId,
          context.paymentId,
          options.provider,
          options.eventId,
          options.eventType,
          options.dataId,
          payloadJson,
          payloadHash,
        ],
      );
      if (event.rowCount === 0) {
        if (options.source === "poll") {
          await executor.query(
            `UPDATE payments SET last_reconciled_at = now(), updated_at = now()
              WHERE organization_id = $1 AND id = $2`,
            [context.organizationId, context.paymentId],
          );
        }
        return { duplicate: true, outcome: "ignored" };
      }

      const status = options.providerOrder.status;
      await executor.query(
        `UPDATE payment_attempts
            SET status = CASE
                  WHEN status = 'REFUNDED' THEN status
                  WHEN status = 'APPROVED' AND $3 <> 'REFUNDED' THEN status
                  ELSE $3
                END,
                completed_at = CASE WHEN $3 IN ('APPROVED','REJECTED','CANCELLED','REFUNDED')
                                    THEN COALESCE(completed_at, now()) ELSE completed_at END,
                updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [context.organizationId, context.attemptId, status],
      );
      await executor.query(
        `UPDATE payments
            SET status = CASE
                  WHEN status = 'REFUNDED' THEN status
                  WHEN status = 'APPROVED' AND $3 <> 'REFUNDED' THEN status
                  ELSE $3
                END,
                provider_payment_id = COALESCE($4, provider_payment_id),
                provider_status = $5, provider_status_detail = $6,
                approved_at = CASE WHEN $3 = 'APPROVED' THEN COALESCE(approved_at, now()) ELSE approved_at END,
                cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
                refunded_at = CASE WHEN $3 = 'REFUNDED' THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
                last_reconciled_at = now(), updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [
          context.organizationId,
          context.paymentId,
          status,
          options.providerOrder.providerPaymentId ?? null,
          status,
          options.providerOrder.statusDetail,
        ],
      );
      if (status === "APPROVED" && context.orderStatus === "PENDING_PAYMENT") {
        await commitOrderReservations(executor, {
          organizationId: context.organizationId,
          orderId: context.orderId,
          requestId: options.requestId,
        });
        const updated = await executor.query(
          `UPDATE orders SET status = 'PAID', payment_status = 'PAID', updated_at = now()
            WHERE organization_id = $1 AND id = $2 AND status = 'PENDING_PAYMENT'`,
          [context.organizationId, context.orderId],
        );
        if ((updated.rowCount ?? 0) > 0) {
          await executor.query(
            `INSERT INTO order_status_events
               (organization_id, order_id, from_status, to_status, actor_user_id,
                reason, occurred_at)
             VALUES ($1, $2, 'PENDING_PAYMENT', 'PAID', NULL,
                     $3, now())`,
            [
              context.organizationId,
              context.orderId,
              options.source === "webhook"
                ? "Pago confirmado por webhook autoritativo."
                : "Pago confirmado por conciliación autoritativa.",
            ],
          );
          await enqueueNotification(executor, {
            organizationId: context.organizationId,
            eventKey: `order.payment.approved:${context.paymentId}`,
            eventType: "order.payment.approved",
            recipientEmail: context.customerEmail,
            payload: {
              firstName: context.customerFirstName,
              orderNumber: context.orderNumber,
              total: context.amount,
            },
          });
        }
      } else if (
        options.providerOrder.isFinal &&
        (status === "REJECTED" || status === "CANCELLED") &&
        context.orderStatus === "PENDING_PAYMENT"
      ) {
        await releaseOrderReservations(executor, {
          organizationId: context.organizationId,
          orderId: context.orderId,
          requestId: options.requestId,
          reason: "rejected",
        });
      } else if (status === "REFUNDED" && context.orderStatus !== "REFUNDED") {
        const changed = await executor.query(
          `UPDATE orders SET status = 'REFUNDED', payment_status = 'REFUNDED', updated_at = now()
            WHERE organization_id = $1 AND id = $2 AND status <> 'REFUNDED'`,
          [context.organizationId, context.orderId],
        );
        if ((changed.rowCount ?? 0) > 0) {
          await executor.query(
            `INSERT INTO order_status_events
               (organization_id, order_id, from_status, to_status, actor_user_id,
                reason, occurred_at)
             VALUES ($1, $2, $3, 'REFUNDED', NULL,
                     'Reembolso confirmado por proveedor.', now())`,
            [context.organizationId, context.orderId, context.orderStatus],
          );
          await enqueueNotification(executor, {
            organizationId: context.organizationId,
            eventKey: `order.refunded:${context.paymentId}`,
            eventType: "order.refunded",
            recipientEmail: context.customerEmail,
            payload: {
              firstName: context.customerFirstName,
              orderNumber: context.orderNumber,
              total: context.amount,
            },
          });
        }
      }
      await executor.query(
        `UPDATE payment_provider_events
            SET processed = true, processed_at = now(), last_processing_error = NULL
          WHERE provider = $1 AND provider_event_id = $2`,
        [options.provider, options.eventId],
      );
      await writeAudit(executor, {
        organizationId: context.organizationId,
        action: options.source === "webhook"
          ? "payment.webhook.process"
          : "payment.reconciliation.process",
        entityType: "Payment",
        entityId: context.paymentId,
        after: {
          eventId: options.eventId,
          providerOrderId: options.dataId,
          status,
          statusDetail: options.providerOrder.statusDetail,
        },
        requestId: options.requestId,
      });
      return { duplicate: false, outcome: "processed" };
    });
  }
}
