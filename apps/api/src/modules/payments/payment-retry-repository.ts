import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import type { PreparedCheckout } from "../checkout/checkout-repository.js";
import {
  releaseOrderReservations,
  reserveOrderInventory,
  type CheckoutProduct,
} from "../inventory/order-reservations.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { hmacSha256, secureBufferEquals, stableJson } from "../../shared/security/fingerprint.js";

type ExistingIdempotencyRow = Readonly<{
  requestHash: Buffer;
  status: "IN_PROGRESS" | "COMPLETED";
  responseJson: unknown | null;
  resourceId: string | null;
}>;

type RetryContext = Readonly<{
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentId: string;
  paymentStatus: string;
  provider: "FAKE" | "MERCADOPAGO";
  payerEmail: string;
  total: number;
}>;

type AttemptRow = Readonly<{ id: string; attemptNumber: number }>;
type ExpiryRow = Readonly<{ expiresAt: Date | null; dueCount: number; activeCount: number }>;

async function loadProducts(
  executor: SqlExecutor,
  organizationId: string,
  orderId: string,
): Promise<readonly CheckoutProduct[]> {
  const result = await executor.query<CheckoutProduct>(
    `SELECT product.id, item.sku_snapshot AS sku,
            item.product_name_snapshot AS name, item.unit_price AS "salePrice",
            item.quantity, item.line_total AS "lineTotal"
       FROM order_items item
       JOIN products product ON product.organization_id = item.organization_id
        AND product.id = item.product_id
      WHERE item.organization_id = $1 AND item.order_id = $2
      ORDER BY product.id ASC`,
    [organizationId, orderId],
  );
  return result.rows;
}

export class PaymentRetryRepository {
  readonly #database: PostgresDatabase;
  readonly #idempotencySecret: string;

  constructor(database: PostgresDatabase, idempotencySecret: string) {
    this.#database = database;
    this.#idempotencySecret = idempotencySecret;
  }

  prepare(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    orderId: string;
    idempotencyKey: string;
    requestId: string;
    reservationMinutes: number;
  }>): Promise<PreparedCheckout> {
    const keyHash = hmacSha256(
      this.#idempotencySecret,
      "idempotency-key",
      `${options.organizationId}\0${options.actorUserId}\0${options.idempotencyKey}`,
    );
    const requestHash = hmacSha256(
      this.#idempotencySecret,
      "idempotency-request",
      stableJson({ operation: "payment.retry", payload: { orderId: options.orderId } }),
    );
    return this.#database.sqlTransaction(async (executor) => {
      const inserted = await executor.query(
        `INSERT INTO idempotency_records
           (organization_id, actor_user_id, key_hash, request_hash, operation,
            status, original_request_id, expires_at)
         VALUES ($1, $2, $3, $4, 'payment.retry', 'IN_PROGRESS', $5,
                 now() + interval '24 hours')
         ON CONFLICT (organization_id, actor_user_id, key_hash) DO NOTHING`,
        [options.organizationId, options.actorUserId, keyHash, requestHash, options.requestId],
      );
      if (inserted.rowCount === 0) {
        const existing = await executor.query<ExistingIdempotencyRow>(
          `SELECT request_hash AS "requestHash", status,
                  response_json AS "responseJson", resource_id AS "resourceId"
             FROM idempotency_records
            WHERE organization_id = $1 AND actor_user_id = $2 AND key_hash = $3
            FOR UPDATE`,
          [options.organizationId, options.actorUserId, keyHash],
        );
        const row = existing.rows[0];
        if (row === undefined || !secureBufferEquals(row.requestHash, requestHash)) {
          throw new AppError({
            statusCode: 409,
            code: "IDEMPOTENCY_CONFLICT",
            message: "La clave de idempotencia ya fue usada con otra solicitud.",
          });
        }
        if (row.status === "COMPLETED") {
          if (row.responseJson === null) throw new Error("Completed retry has no response.");
          const replay = row.responseJson as PreparedCheckout["replay"];
          if (replay === null) throw new Error("Stored retry response is invalid.");
          return {
            replay,
            idempotencyKeyHash: keyHash,
            orderId: replay.order.id,
            orderNumber: replay.order.orderNumber,
            paymentId: replay.payment.id,
            attemptId: replay.attempt.id,
            provider: replay.payment.provider,
            payerEmail: "",
            total: replay.order.total,
            expiresAt: new Date(replay.reservationExpiresAt),
            products: [],
          };
        }
        if (row.resourceId === null) {
          throw new AppError({
            statusCode: 409,
            code: "CONFLICT",
            message: "El reintento todavía está en curso.",
          });
        }
        return this.#restore(executor, options.organizationId, row.resourceId, keyHash);
      }

      const locked = await executor.query<RetryContext>(
        `SELECT orders.id AS "orderId", orders.order_number AS "orderNumber",
                orders.status AS "orderStatus", payment.id AS "paymentId",
                payment.status AS "paymentStatus", payment.provider,
                customer.email AS "payerEmail", orders.total
           FROM orders
           JOIN customers customer ON customer.organization_id = orders.organization_id
            AND customer.id = orders.customer_id
           JOIN payments payment ON payment.organization_id = orders.organization_id
            AND payment.order_id = orders.id
          WHERE orders.organization_id = $1 AND orders.id = $2
            AND orders.customer_id = $3
          FOR UPDATE OF orders, payment`,
        [options.organizationId, options.orderId, options.customerId],
      );
      const context = locked.rows[0];
      if (context === undefined) {
        throw new AppError({ statusCode: 404, code: "NOT_FOUND", message: "No se encontró el pedido." });
      }
      if (context.orderStatus !== "PENDING_PAYMENT" || context.paymentStatus === "APPROVED") {
        throw new AppError({
          statusCode: 409,
          code: "PAYMENT_RETRY_NOT_ALLOWED",
          message: "Este pedido no admite otro intento de pago.",
        });
      }
      let expiry = await this.#reservationExpiry(executor, options.organizationId, options.orderId);
      if (expiry.dueCount > 0) {
        await releaseOrderReservations(executor, {
          organizationId: options.organizationId,
          orderId: options.orderId,
          requestId: options.requestId,
          reason: "expired",
        });
        expiry = { expiresAt: null, dueCount: 0, activeCount: 0 };
      }
      const products = await loadProducts(executor, options.organizationId, options.orderId);
      let expiresAt = expiry.expiresAt;
      if (expiry.activeCount === 0 || expiresAt === null) {
        expiresAt = new Date(Date.now() + options.reservationMinutes * 60_000);
        await reserveOrderInventory(executor, {
          organizationId: options.organizationId,
          orderId: options.orderId,
          products,
          expiresAt,
          actorUserId: options.actorUserId,
          requestId: options.requestId,
        });
      }
      const attempt = await executor.query<AttemptRow>(
        `INSERT INTO payment_attempts
           (organization_id, payment_id, attempt_number, status, started_at, updated_at)
         SELECT $1, $2, COALESCE(MAX(attempt_number), 0) + 1, 'CREATED', now(), now()
           FROM payment_attempts WHERE organization_id = $1 AND payment_id = $2
         RETURNING id, attempt_number AS "attemptNumber"`,
        [options.organizationId, context.paymentId],
      );
      const attemptRow = attempt.rows[0];
      if (attemptRow === undefined) throw new Error("Payment retry insert returned no row.");
      await executor.query(
        `UPDATE payments SET status = 'CREATED', cancelled_at = NULL, updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [options.organizationId, context.paymentId],
      );
      await executor.query(
        `UPDATE idempotency_records SET resource_type = 'PaymentAttempt', resource_id = $4
          WHERE organization_id = $1 AND actor_user_id = $2 AND key_hash = $3`,
        [options.organizationId, options.actorUserId, keyHash, attemptRow.id],
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "payment.attempt.retry",
        entityType: "PaymentAttempt",
        entityId: attemptRow.id,
        after: { orderId: options.orderId, attemptNumber: attemptRow.attemptNumber },
        requestId: options.requestId,
      });
      return {
        replay: null,
        idempotencyKeyHash: keyHash,
        orderId: context.orderId,
        orderNumber: context.orderNumber,
        paymentId: context.paymentId,
        attemptId: attemptRow.id,
        provider: context.provider,
        payerEmail: context.payerEmail,
        total: context.total,
        expiresAt,
        products,
      };
    });
  }

  async #reservationExpiry(
    executor: SqlExecutor,
    organizationId: string,
    orderId: string,
  ): Promise<ExpiryRow> {
    const result = await executor.query<ExpiryRow>(
      `SELECT MIN(expires_at) FILTER (WHERE status = 'ACTIVE') AS "expiresAt",
              COUNT(*) FILTER (WHERE status = 'ACTIVE' AND expires_at <= now())::integer AS "dueCount",
              COUNT(*) FILTER (WHERE status = 'ACTIVE')::integer AS "activeCount"
         FROM inventory_reservations
        WHERE organization_id = $1 AND order_id = $2`,
      [organizationId, orderId],
    );
    return result.rows[0] ?? { expiresAt: null, dueCount: 0, activeCount: 0 };
  }

  async #restore(
    executor: SqlExecutor,
    organizationId: string,
    attemptId: string,
    keyHash: Buffer,
  ): Promise<PreparedCheckout> {
    const result = await executor.query<RetryContext & Readonly<{ attemptId: string; expiresAt: Date }>>(
      `SELECT orders.id AS "orderId", orders.order_number AS "orderNumber",
              orders.status AS "orderStatus", payment.id AS "paymentId",
              payment.status AS "paymentStatus", payment.provider,
              customer.email AS "payerEmail", orders.total,
              attempt.id AS "attemptId", MIN(reservation.expires_at) AS "expiresAt"
         FROM payment_attempts attempt
         JOIN payments payment ON payment.organization_id = attempt.organization_id
          AND payment.id = attempt.payment_id
         JOIN orders ON orders.organization_id = payment.organization_id
          AND orders.id = payment.order_id
         JOIN customers customer ON customer.organization_id = orders.organization_id
          AND customer.id = orders.customer_id
         JOIN inventory_reservations reservation
          ON reservation.organization_id = orders.organization_id
         AND reservation.order_id = orders.id AND reservation.status = 'ACTIVE'
        WHERE attempt.organization_id = $1 AND attempt.id = $2
        GROUP BY orders.id, payment.id, customer.id, attempt.id`,
      [organizationId, attemptId],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Payment retry could not be restored.");
    return {
      replay: null,
      idempotencyKeyHash: keyHash,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      paymentId: row.paymentId,
      attemptId: row.attemptId,
      provider: row.provider,
      payerEmail: row.payerEmail,
      total: row.total,
      expiresAt: row.expiresAt,
      products: await loadProducts(executor, organizationId, row.orderId),
    };
  }
}

