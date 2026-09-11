import {
  customerOrderCancellationResponseSchema,
  type CustomerOrderCancellationResponse,
} from "@tracelink/contracts";

import type { PostgresDatabase } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { IdempotencyService, type IdempotencyExecution } from "../../shared/idempotency/idempotency.js";
import { releaseOrderReservations } from "../inventory/order-reservations.js";

export class CustomerOrderActionsService {
  readonly #idempotency: IdempotencyService;

  constructor(database: PostgresDatabase, idempotencySecret: string) {
    this.#idempotency = new IdempotencyService(database, idempotencySecret);
  }

  cancel(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    orderId: string;
    reason: string;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<IdempotencyExecution<CustomerOrderCancellationResponse>> {
    return this.#idempotency.execute({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      key: options.idempotencyKey,
      operation: "customer.order.cancel",
      payload: { orderId: options.orderId, reason: options.reason },
      requestId: options.requestId,
      responseSchema: customerOrderCancellationResponseSchema,
      mutation: async (executor) => {
        const result = await executor.query<Readonly<{
          status: string;
          paymentStatus: string | null;
        }>>(
          `SELECT orders.status, payment.status AS "paymentStatus"
             FROM orders
             LEFT JOIN payments payment ON payment.organization_id = orders.organization_id
              AND payment.order_id = orders.id
            WHERE orders.organization_id = $1 AND orders.id = $2
              AND orders.customer_id = $3
            FOR UPDATE OF orders, payment`,
          [options.organizationId, options.orderId, options.customerId],
        );
        const order = result.rows[0];
        if (order === undefined) {
          throw new AppError({ statusCode: 404, code: "NOT_FOUND", message: "No se encontró el pedido." });
        }
        if (order.status !== "PENDING_PAYMENT" || order.paymentStatus === "APPROVED") {
          throw new AppError({
            statusCode: 409,
            code: "ORDER_CANCELLATION_NOT_ALLOWED",
            message: "Solo puedes cancelar un pedido pendiente antes de que se apruebe el pago.",
          });
        }
        await releaseOrderReservations(executor, {
          organizationId: options.organizationId,
          orderId: options.orderId,
          requestId: options.requestId,
          reason: "cancelled",
        });
        await executor.query(
          `UPDATE orders SET status = 'CANCELLED', updated_at = now()
            WHERE organization_id = $1 AND id = $2`,
          [options.organizationId, options.orderId],
        );
        await executor.query(
          `UPDATE payments SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
            WHERE organization_id = $1 AND order_id = $2
              AND status NOT IN ('APPROVED','REFUNDED')`,
          [options.organizationId, options.orderId],
        );
        await executor.query(
          `UPDATE payment_attempts attempt
              SET status = 'CANCELLED', completed_at = now(), updated_at = now()
             FROM payments payment
            WHERE attempt.organization_id = $1
              AND payment.organization_id = attempt.organization_id
              AND payment.id = attempt.payment_id AND payment.order_id = $2
              AND attempt.status NOT IN ('APPROVED','REFUNDED')`,
          [options.organizationId, options.orderId],
        );
        await executor.query(
          `INSERT INTO order_status_events
             (organization_id, order_id, from_status, to_status, actor_user_id,
              reason, occurred_at)
           VALUES ($1, $2, 'PENDING_PAYMENT', 'CANCELLED', $3, $4, now())`,
          [options.organizationId, options.orderId, options.actorUserId, options.reason],
        );
        await writeAudit(executor, {
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          action: "customer.order.cancel",
          entityType: "Order",
          entityId: options.orderId,
          before: { status: "PENDING_PAYMENT" },
          after: { status: "CANCELLED", reason: options.reason },
          requestId: options.requestId,
        });
        return {
          statusCode: 200,
          body: {
            orderId: options.orderId,
            status: "CANCELLED" as const,
            paymentStatus: "CANCELLED" as const,
          },
          resourceType: "Order",
          resourceId: options.orderId,
        };
      },
    });
  }
}
