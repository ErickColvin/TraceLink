import { randomUUID } from "node:crypto";
import type { CheckoutResponse, CreateCheckoutRequest } from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import {
  commitOrderReservations,
  loadCheckoutProducts,
  releaseOrderReservations,
  reserveOrderInventory,
  type CheckoutProduct,
} from "../inventory/order-reservations.js";
import type { ProviderOrderSnapshot } from "../payments/payment-provider.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { enqueueNotification } from "../notifications/notification-outbox.js";
import {
  hmacSha256,
  secureBufferEquals,
  stableJson,
} from "../../shared/security/fingerprint.js";

export type CheckoutCommand = CreateCheckoutRequest;
export type CheckoutResult = CheckoutResponse;

export type PreparedCheckout = Readonly<{
  replay: CheckoutResult | null;
  idempotencyKeyHash: Buffer;
  orderId: string;
  orderNumber: string;
  paymentId: string;
  attemptId: string;
  provider: "FAKE" | "MERCADOPAGO";
  payerEmail: string;
  total: number;
  expiresAt: Date;
  products: readonly CheckoutProduct[];
}>;

type IdempotencyRow = Readonly<{
  requestHash: Buffer;
  status: "IN_PROGRESS" | "COMPLETED";
  responseJson: unknown | null;
  resourceId: string | null;
}>;

type PreparedRow = Readonly<{
  orderId: string;
  orderNumber: string;
  paymentId: string;
  attemptId: string;
  provider: "FAKE" | "MERCADOPAGO";
  payerEmail: string;
  total: number;
  expiresAt: Date;
}>;

type ItemRow = Readonly<{
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  quantity: number;
  lineTotal: number;
}>;

function idempotencyConflict(message: string): AppError {
  return new AppError({ statusCode: 409, code: "IDEMPOTENCY_CONFLICT", message });
}

function resultFromJson(value: unknown): CheckoutResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("Stored checkout response is invalid.");
  }
  return value as CheckoutResult;
}

type CheckoutResponseRow = Readonly<{
  orderId: string;
  orderNumber: string;
  orderStatus: CheckoutResponse["order"]["status"];
  orderPaymentStatus: CheckoutResponse["order"]["paymentStatus"];
  fulfillmentMethod: "PICKUP";
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  orderCreatedAt: Date;
  paymentId: string;
  provider: CheckoutResponse["payment"]["provider"];
  paymentLifecycleStatus: CheckoutResponse["payment"]["status"];
  currency: string;
  providerExternalReference: string;
  providerPaymentId: string | null;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  approvedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  lastReconciledAt: Date | null;
  paymentCreatedAt: Date;
  paymentUpdatedAt: Date;
  attemptId: string;
  attemptNumber: number;
  attemptStatus: CheckoutResponse["attempt"]["status"];
  providerOrderId: string | null;
  providerPreferenceId: string | null;
  checkoutUrl: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  attemptCreatedAt: Date;
  attemptUpdatedAt: Date;
  reservationExpiresAt: Date;
}>;

async function loadCheckoutResponse(
  executor: SqlExecutor,
  organizationId: string,
  paymentId: string,
  attemptId: string,
): Promise<CheckoutResult> {
  const result = await executor.query<CheckoutResponseRow>(
    `SELECT orders.id AS "orderId", orders.order_number AS "orderNumber",
            orders.status AS "orderStatus", orders.payment_status AS "orderPaymentStatus",
            orders.fulfillment_type AS "fulfillmentMethod", orders.subtotal,
            orders.discount AS "discountTotal", orders.shipping AS "deliveryFee",
            orders.total, orders.created_at AS "orderCreatedAt",
            payment.id AS "paymentId", payment.provider,
            payment.status AS "paymentLifecycleStatus", payment.currency,
            payment.provider_external_reference AS "providerExternalReference",
            payment.provider_payment_id AS "providerPaymentId",
            payment.provider_status AS "providerStatus",
            payment.provider_status_detail AS "providerStatusDetail",
            payment.approved_at AS "approvedAt", payment.cancelled_at AS "cancelledAt",
            payment.refunded_at AS "refundedAt",
            payment.last_reconciled_at AS "lastReconciledAt",
            payment.created_at AS "paymentCreatedAt",
            payment.updated_at AS "paymentUpdatedAt",
            attempt.id AS "attemptId", attempt.attempt_number AS "attemptNumber",
            attempt.status AS "attemptStatus", attempt.provider_order_id AS "providerOrderId",
            attempt.provider_preference_id AS "providerPreferenceId",
            attempt.checkout_url AS "checkoutUrl", attempt.error_code AS "errorCode",
            attempt.error_message AS "errorMessage", attempt.started_at AS "startedAt",
            attempt.completed_at AS "completedAt", attempt.created_at AS "attemptCreatedAt",
            attempt.updated_at AS "attemptUpdatedAt",
            MIN(reservation.expires_at) AS "reservationExpiresAt"
       FROM payments payment
       JOIN orders ON orders.organization_id = payment.organization_id
        AND orders.id = payment.order_id
       JOIN payment_attempts attempt ON attempt.organization_id = payment.organization_id
        AND attempt.payment_id = payment.id AND attempt.id = $3
       JOIN inventory_reservations reservation
        ON reservation.organization_id = orders.organization_id
       AND reservation.order_id = orders.id
      WHERE payment.organization_id = $1 AND payment.id = $2
      GROUP BY orders.id, payment.id, attempt.id`,
    [organizationId, paymentId, attemptId],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Checkout response could not be loaded.");
  return {
    order: {
      id: row.orderId,
      orderNumber: row.orderNumber,
      status: row.orderStatus,
      paymentStatus: row.orderPaymentStatus,
      fulfillmentMethod: row.fulfillmentMethod,
      subtotal: row.subtotal,
      discountTotal: row.discountTotal,
      deliveryFee: row.deliveryFee,
      total: row.total,
      createdAt: row.orderCreatedAt.toISOString(),
    },
    payment: {
      id: row.paymentId,
      orderId: row.orderId,
      provider: row.provider,
      status: row.paymentLifecycleStatus,
      amount: row.total,
      currency: row.currency,
      providerExternalReference: row.providerExternalReference,
      ...(row.providerPaymentId === null ? {} : { providerPaymentId: row.providerPaymentId }),
      ...(row.providerStatus === null ? {} : { providerStatus: row.providerStatus }),
      ...(row.providerStatusDetail === null ? {} : { providerStatusDetail: row.providerStatusDetail }),
      ...(row.approvedAt === null ? {} : { approvedAt: row.approvedAt.toISOString() }),
      ...(row.cancelledAt === null ? {} : { cancelledAt: row.cancelledAt.toISOString() }),
      ...(row.refundedAt === null ? {} : { refundedAt: row.refundedAt.toISOString() }),
      ...(row.lastReconciledAt === null ? {} : { lastReconciledAt: row.lastReconciledAt.toISOString() }),
      createdAt: row.paymentCreatedAt.toISOString(),
      updatedAt: row.paymentUpdatedAt.toISOString(),
    },
    attempt: {
      id: row.attemptId,
      paymentId: row.paymentId,
      attemptNumber: row.attemptNumber,
      status: row.attemptStatus,
      ...(row.providerOrderId === null ? {} : { providerOrderId: row.providerOrderId }),
      ...(row.providerPreferenceId === null ? {} : { providerPreferenceId: row.providerPreferenceId }),
      checkoutUrl: row.checkoutUrl,
      ...(row.errorCode === null ? {} : { errorCode: row.errorCode }),
      ...(row.errorMessage === null ? {} : { errorMessage: row.errorMessage }),
      startedAt: row.startedAt.toISOString(),
      ...(row.completedAt === null ? {} : { completedAt: row.completedAt.toISOString() }),
      createdAt: row.attemptCreatedAt.toISOString(),
      updatedAt: row.attemptUpdatedAt.toISOString(),
    },
    checkoutUrl: row.checkoutUrl,
    reservationExpiresAt: row.reservationExpiresAt.toISOString(),
  };
}

function createOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `CHM-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export class CheckoutRepository {
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
    provider: "FAKE" | "MERCADOPAGO";
    input: CheckoutCommand;
    requestId: string;
    idempotencyKey: string;
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
      stableJson({ operation: "checkout.create", payload: options.input }),
    );
    return this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        `DELETE FROM idempotency_records
          WHERE organization_id = $1 AND actor_user_id = $2
            AND key_hash = $3 AND expires_at <= now()`,
        [options.organizationId, options.actorUserId, keyHash],
      );
      const inserted = await executor.query(
        `INSERT INTO idempotency_records
           (organization_id, actor_user_id, key_hash, request_hash, operation,
            status, original_request_id, expires_at)
         VALUES ($1, $2, $3, $4, 'checkout.create', 'IN_PROGRESS', $5,
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
          throw idempotencyConflict("La clave de idempotencia ya fue usada con otra solicitud.");
        }
        if (row.status === "COMPLETED") {
          if (row.responseJson === null) throw new Error("Completed checkout has no response.");
          const replay = resultFromJson(row.responseJson);
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
          throw idempotencyConflict("La operación con esta clave todavía está en curso.");
        }
        return this.#loadPrepared(executor, options.organizationId, row.resourceId, keyHash);
      }

      const products = await loadCheckoutProducts(executor, options.organizationId, options.input.items);
      const total = products.reduce((sum, product) => sum + product.lineTotal, 0);
      if (!Number.isSafeInteger(total)) {
        throw new AppError({
          statusCode: 409,
          code: "ORDER_TOTAL_OVERFLOW",
          message: "El total del pedido supera el límite permitido.",
        });
      }
      const customer = await executor.query<Readonly<{
        email: string;
        firstName: string;
      }>>(
        `SELECT email, first_name AS "firstName" FROM customers
          WHERE organization_id = $1 AND id = $2 AND status = 'ACTIVE'
          FOR SHARE`,
        [options.organizationId, options.customerId],
      );
      const payerEmail = customer.rows[0]?.email;
      const customerFirstName = customer.rows[0]?.firstName;
      if (payerEmail === undefined || customerFirstName === undefined) {
        throw new AppError({
          statusCode: 403,
          code: "CUSTOMER_UNAVAILABLE",
          message: "La cuenta de cliente no está habilitada para comprar.",
        });
      }
      const orderNumber = createOrderNumber();
      const order = await executor.query<Readonly<{ id: string }>>(
        `INSERT INTO orders
           (organization_id, customer_id, order_number, status, payment_status,
            fulfillment_type, subtotal, discount, shipping, total, notes, updated_at)
         VALUES ($1, $2, $3, 'PENDING_PAYMENT', 'PENDING', 'PICKUP',
                 $4, 0, 0, $4, $5, now()) RETURNING id`,
        [options.organizationId, options.customerId, orderNumber, total, options.input.notes ?? null],
      );
      const orderId = order.rows[0]?.id;
      if (orderId === undefined) throw new Error("Order insert returned no row.");
      for (const product of products) {
        await executor.query(
          `INSERT INTO order_items
             (organization_id, order_id, product_id, sku_snapshot,
              product_name_snapshot, unit_price, quantity, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            options.organizationId,
            orderId,
            product.id,
            product.sku,
            product.name,
            product.salePrice,
            product.quantity,
            product.lineTotal,
          ],
        );
      }
      await executor.query(
        `INSERT INTO order_status_events
           (organization_id, order_id, from_status, to_status, actor_user_id,
            reason, occurred_at)
         VALUES ($1, $2, NULL, 'PENDING_PAYMENT', $3,
                 'Checkout iniciado por el cliente.', now())`,
        [options.organizationId, orderId, options.actorUserId],
      );
      const expiresAt = new Date(Date.now() + options.reservationMinutes * 60_000);
      await reserveOrderInventory(executor, {
        organizationId: options.organizationId,
        orderId,
        products,
        expiresAt,
        actorUserId: options.actorUserId,
        requestId: options.requestId,
      });
      const payment = await executor.query<Readonly<{ id: string }>>(
        `INSERT INTO payments
           (organization_id, order_id, provider, status, amount, currency,
            provider_external_reference, updated_at)
         VALUES ($1, $2, $3, 'CREATED', $4, 'CLP', $5, now())
         RETURNING id`,
        [options.organizationId, orderId, options.provider, total, orderId],
      );
      const paymentId = payment.rows[0]?.id;
      if (paymentId === undefined) throw new Error("Payment insert returned no row.");
      const attempt = await executor.query<Readonly<{ id: string }>>(
        `INSERT INTO payment_attempts
           (organization_id, payment_id, attempt_number, status, started_at, updated_at)
         VALUES ($1, $2, 1, 'CREATED', now(), now()) RETURNING id`,
        [options.organizationId, paymentId],
      );
      const attemptId = attempt.rows[0]?.id;
      if (attemptId === undefined) throw new Error("Payment attempt insert returned no row.");
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "checkout.create",
        entityType: "Order",
        entityId: orderId,
        after: { orderNumber, total, currency: "CLP", paymentId, attemptId },
        requestId: options.requestId,
      });
      await enqueueNotification(executor, {
        organizationId: options.organizationId,
        eventKey: `order.created:${orderId}`,
        eventType: "order.created",
        recipientEmail: payerEmail,
        payload: { firstName: customerFirstName, orderNumber, total },
      });
      await executor.query(
        `UPDATE idempotency_records
            SET resource_type = 'Order', resource_id = $4
          WHERE organization_id = $1 AND actor_user_id = $2 AND key_hash = $3`,
        [options.organizationId, options.actorUserId, keyHash, orderId],
      );
      return {
        replay: null,
        idempotencyKeyHash: keyHash,
        orderId,
        orderNumber,
        paymentId,
        attemptId,
        provider: options.provider,
        payerEmail,
        total,
        expiresAt,
        products,
      };
    });
  }

  async finalize(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    requestId: string;
    prepared: PreparedCheckout;
    providerOrder: ProviderOrderSnapshot;
  }>): Promise<CheckoutResult> {
    return this.#database.sqlTransaction(async (executor) => {
      if (
        options.providerOrder.externalReference !== options.prepared.orderId ||
        options.providerOrder.total !== options.prepared.total ||
        options.providerOrder.currency !== "CLP"
      ) {
        throw new AppError({
          statusCode: 502,
          code: "PAYMENT_PROVIDER_MISMATCH",
          message: "La respuesta del proveedor no coincide con el pedido.",
        });
      }
      if (options.providerOrder.checkoutUrl === undefined) {
        throw new AppError({
          statusCode: 502,
          code: "PAYMENT_CHECKOUT_URL_MISSING",
          message: "El proveedor no devolvió una URL de pago válida.",
        });
      }
      await executor.query(
        `UPDATE payment_attempts
            SET status = $4, provider_order_id = $5, checkout_url = $6,
                error_code = NULL, error_message = NULL,
                completed_at = CASE WHEN $4 IN ('APPROVED','REJECTED','CANCELLED','REFUNDED')
                                    THEN now() ELSE NULL END,
                updated_at = now()
          WHERE organization_id = $1 AND payment_id = $2 AND id = $3`,
        [
          options.organizationId,
          options.prepared.paymentId,
          options.prepared.attemptId,
          options.providerOrder.status,
          options.providerOrder.providerOrderId,
          options.providerOrder.checkoutUrl,
        ],
      );
      await executor.query(
        `UPDATE payments
            SET status = CASE
                  WHEN status = 'REFUNDED' THEN status
                  WHEN status = 'APPROVED' AND $3 NOT IN ('REFUNDED') THEN status
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
          options.organizationId,
          options.prepared.paymentId,
          options.providerOrder.status,
          options.providerOrder.providerPaymentId ?? null,
          options.providerOrder.status,
          options.providerOrder.statusDetail,
        ],
      );
      if (options.providerOrder.status === "APPROVED") {
        const changed = await executor.query(
          `UPDATE orders SET status = 'PAID', payment_status = 'PAID', updated_at = now()
            WHERE organization_id = $1 AND id = $2 AND status = 'PENDING_PAYMENT'`,
          [options.organizationId, options.prepared.orderId],
        );
        await commitOrderReservations(executor, {
          organizationId: options.organizationId,
          orderId: options.prepared.orderId,
          requestId: options.requestId,
        });
        if ((changed.rowCount ?? 0) > 0) {
          await executor.query(
            `INSERT INTO order_status_events
               (organization_id, order_id, from_status, to_status, actor_user_id,
                reason, occurred_at)
             VALUES ($1, $2, 'PENDING_PAYMENT', 'PAID', NULL,
                     'Pago aprobado por el proveedor.', now())`,
            [options.organizationId, options.prepared.orderId],
          );
        }
      } else if (
        options.providerOrder.isFinal &&
        ["REJECTED", "CANCELLED"].includes(options.providerOrder.status)
      ) {
        await releaseOrderReservations(executor, {
          organizationId: options.organizationId,
          orderId: options.prepared.orderId,
          requestId: options.requestId,
          reason: "rejected",
        });
      }
      const result = await loadCheckoutResponse(
        executor,
        options.organizationId,
        options.prepared.paymentId,
        options.prepared.attemptId,
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "payment.attempt.provider-created",
        entityType: "PaymentAttempt",
        entityId: options.prepared.attemptId,
        after: {
          providerOrderId: options.providerOrder.providerOrderId,
          status: options.providerOrder.status,
          statusDetail: options.providerOrder.statusDetail,
        },
        requestId: options.requestId,
      });
      await executor.query(
        `UPDATE idempotency_records
            SET status = 'COMPLETED', response_status = 201,
                response_json = $4::jsonb
          WHERE organization_id = $1 AND actor_user_id = $2
            AND key_hash = $3 AND status = 'IN_PROGRESS'`,
        [
          options.organizationId,
          options.actorUserId,
          options.prepared.idempotencyKeyHash,
          JSON.stringify(result),
        ],
      );
      return result;
    });
  }

  markProviderError(options: Readonly<{
    organizationId: string;
    prepared: PreparedCheckout;
    requestId: string;
  }>): Promise<void> {
    return this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        `UPDATE payment_attempts
            SET status = 'ERROR', error_code = 'PROVIDER_UNAVAILABLE',
                error_message = 'Proveedor temporalmente no disponible', updated_at = now()
          WHERE organization_id = $1 AND id = $2 AND status <> 'APPROVED'`,
        [options.organizationId, options.prepared.attemptId],
      );
      await executor.query(
        `UPDATE payments SET status = 'ERROR', updated_at = now()
          WHERE organization_id = $1 AND id = $2 AND status <> 'APPROVED'`,
        [options.organizationId, options.prepared.paymentId],
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        action: "payment.provider.error",
        entityType: "PaymentAttempt",
        entityId: options.prepared.attemptId,
        after: { code: "PROVIDER_UNAVAILABLE" },
        requestId: options.requestId,
      });
    });
  }

  async #loadPrepared(
    executor: SqlExecutor,
    organizationId: string,
    orderId: string,
    keyHash: Buffer,
  ): Promise<PreparedCheckout> {
    const prepared = await executor.query<PreparedRow>(
      `SELECT orders.id AS "orderId", orders.order_number AS "orderNumber",
              payments.id AS "paymentId", attempt.id AS "attemptId",
              payments.provider, customer.email AS "payerEmail", orders.total,
              MIN(reservation.expires_at) AS "expiresAt"
         FROM orders
         JOIN customers customer
           ON customer.organization_id = orders.organization_id
          AND customer.id = orders.customer_id
         JOIN payments ON payments.organization_id = orders.organization_id
          AND payments.order_id = orders.id
         JOIN LATERAL (
           SELECT id FROM payment_attempts
            WHERE organization_id = payments.organization_id
              AND payment_id = payments.id
            ORDER BY attempt_number DESC LIMIT 1
         ) attempt ON true
         JOIN inventory_reservations reservation
           ON reservation.organization_id = orders.organization_id
          AND reservation.order_id = orders.id
        WHERE orders.organization_id = $1 AND orders.id = $2
        GROUP BY orders.id, payments.id, attempt.id, customer.email`,
      [organizationId, orderId],
    );
    const row = prepared.rows[0];
    if (row === undefined) throw new Error("Prepared checkout could not be restored.");
    const items = await executor.query<ItemRow>(
      `SELECT product.id, item.sku_snapshot AS sku,
              item.product_name_snapshot AS name, item.unit_price AS "salePrice",
              item.quantity, item.line_total AS "lineTotal"
         FROM order_items item
         JOIN products product ON product.organization_id = item.organization_id
          AND product.id = item.product_id
        WHERE item.organization_id = $1 AND item.order_id = $2
        ORDER BY item.id ASC`,
      [organizationId, orderId],
    );
    return {
      replay: null,
      idempotencyKeyHash: keyHash,
      ...row,
      products: items.rows,
    };
  }
}
