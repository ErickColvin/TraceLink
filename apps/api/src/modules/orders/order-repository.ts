import type {
  CurrentCustomerOrderListParams,
  Order,
  OrderCancellationRequest,
  OrderItem,
  OrderStatus,
  OrderStatusEvent,
  OrderTransitionRequest,
  StaffOrder,
  StaffOrderListParams,
  StaffOrderPage,
  OrderPage,
  Payment,
  PaymentAttempt,
  PaymentDetails,
  Refund,
} from "@tracelink/contracts";
import {
  orderItemSchema,
  orderPageSchema,
  orderSchema,
  orderStatusEventSchema,
  staffOrderPageSchema,
  staffOrderSchema,
  paymentSchema,
  paymentAttemptSchema,
  refundSchema,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { enqueueNotification } from "../notifications/notification-outbox.js";
import {
  paginationMetadata,
  resolvePagination,
} from "../../shared/pagination/pagination.js";
import {
  canCancelOrder,
  canTransitionOrder,
} from "./order-workflow.js";
import {
  consumeCommittedOrderReservations,
  releaseOrderReservations,
} from "../inventory/order-reservations.js";

type OrderRow = Readonly<{
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: Order["paymentStatus"];
  fulfillmentMethod: Order["fulfillmentMethod"];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  notes: string | null;
  estimatedReadyAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  pickupLocation: string | null;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string | null;
  cancellationReason: string | null;
}>;

type OrderItemRow = Readonly<{
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}>;

type OrderStatusEventRow = Readonly<{
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  occurredAt: Date;
  actorId: string;
  actorName: string;
  reason: string | null;
}>;

type OrderPackageRow = Readonly<{ orderId: string; packageId: string }>;
type CountRow = Readonly<{ total: number }>;
type LockedOrderRow = Readonly<{
  id: string;
  status: OrderStatus;
  orderNumber: string;
  customerEmail: string;
  customerFirstName: string;
  pickupAddress: string | null;
}>;

type OrderRelations = Readonly<{
  itemsByOrder: ReadonlyMap<string, readonly OrderItem[]>;
  eventsByOrder: ReadonlyMap<string, readonly OrderStatusEvent[]>;
  packageIdsByOrder: ReadonlyMap<string, readonly string[]>;
  paymentDetailsByOrder: ReadonlyMap<string, PaymentDetails>;
}>;

type PaymentRow = Readonly<{
  orderId: string;
  id: string;
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

type PaymentAttemptRow = Readonly<{
  paymentId: string;
  id: string;
  attemptNumber: number;
  status: PaymentAttempt["status"];
  providerOrderId: string | null;
  providerPreferenceId: string | null;
  checkoutUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type RefundRow = Readonly<{
  paymentId: string;
  id: string;
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

const ORDER_COLUMNS = `
  o.id,
  o.order_number AS "orderNumber",
  o.customer_id AS "customerId",
  o.status,
  o.payment_status AS "paymentStatus",
  o.fulfillment_type AS "fulfillmentMethod",
  o.subtotal,
  o.discount AS "discountTotal",
  o.shipping AS "deliveryFee",
  o.total,
  o.notes,
  o.estimated_ready_at AS "estimatedReadyAt",
  o.completed_at AS "completedAt",
  o.created_at AS "createdAt",
  o.updated_at AS "updatedAt",
  CASE WHEN o.fulfillment_type = 'PICKUP' THEN settings.pickup_address END
    AS "pickupLocation",
  concat_ws(' ', c.first_name, c.last_name) AS "customerFullName",
  c.email AS "customerEmail",
  c.phone AS "customerPhone",
  (
    SELECT event.reason
      FROM order_status_events event
     WHERE event.organization_id = o.organization_id
       AND event.order_id = o.id
       AND event.to_status = 'CANCELLED'
     ORDER BY event.occurred_at DESC, event.id DESC
     LIMIT 1
  ) AS "cancellationReason"`;

const ORDER_FROM = `
  FROM orders o
  JOIN organizations organization ON organization.id = o.organization_id
  JOIN customers c
    ON c.organization_id = o.organization_id AND c.id = o.customer_id
  LEFT JOIN organization_settings settings
    ON settings.organization_id = o.organization_id`;

function notFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró el pedido solicitado.",
  });
}

function invalidTransition(fromStatus: OrderStatus, toStatus: string): AppError {
  return new AppError({
    statusCode: 409,
    code: "INVALID_STATE_TRANSITION",
    message: `No se puede cambiar un pedido de ${fromStatus} a ${toStatus}.`,
  });
}

function addValue(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function groupRows<Row, Value>(
  rows: readonly Row[],
  key: (row: Row) => string,
  map: (row: Row) => Value,
): ReadonlyMap<string, readonly Value[]> {
  const grouped = new Map<string, Value[]>();
  for (const row of rows) {
    const orderId = key(row);
    const values = grouped.get(orderId) ?? [];
    values.push(map(row));
    grouped.set(orderId, values);
  }
  return grouped;
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return orderItemSchema.parse({
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    ...(row.imageUrl === null ? {} : { imageUrl: row.imageUrl }),
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    lineTotal: row.lineTotal,
  });
}

function toStatusEvent(row: OrderStatusEventRow): OrderStatusEvent {
  return orderStatusEventSchema.parse({
    id: row.id,
    orderId: row.orderId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    occurredAt: row.occurredAt.toISOString(),
    actorId: row.actorId,
    actorName: row.actorName,
    ...(row.reason === null ? {} : { reason: row.reason }),
  });
}

function toPayment(row: PaymentRow): Payment {
  return paymentSchema.parse({
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
  });
}

function toPaymentAttempt(row: PaymentAttemptRow): PaymentAttempt {
  return paymentAttemptSchema.parse({
    id: row.id,
    paymentId: row.paymentId,
    attemptNumber: row.attemptNumber,
    status: row.status,
    ...(row.providerOrderId === null ? {} : { providerOrderId: row.providerOrderId }),
    ...(row.providerPreferenceId === null ? {} : { providerPreferenceId: row.providerPreferenceId }),
    ...(row.checkoutUrl === null ? {} : { checkoutUrl: row.checkoutUrl }),
    ...(row.errorCode === null ? {} : { errorCode: row.errorCode }),
    ...(row.errorMessage === null ? {} : { errorMessage: row.errorMessage }),
    startedAt: row.startedAt.toISOString(),
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toRefund(row: RefundRow): Refund {
  return refundSchema.parse({
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
  });
}

function baseOrder(row: OrderRow, relations: OrderRelations): Order {
  return orderSchema.parse({
    id: row.id,
    orderNumber: row.orderNumber,
    customerId: row.customerId,
    status: row.status,
    paymentStatus: row.paymentStatus,
    fulfillmentMethod: row.fulfillmentMethod,
    items: relations.itemsByOrder.get(row.id) ?? [],
    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    deliveryFee: row.deliveryFee,
    total: row.total,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.estimatedReadyAt === null
      ? {}
      : { estimatedReadyAt: row.estimatedReadyAt.toISOString() }),
    ...(row.completedAt === null
      ? {}
      : { completedAt: row.completedAt.toISOString() }),
    ...(row.pickupLocation === null
      ? {}
      : { pickupLocation: row.pickupLocation }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    packageIds: relations.packageIdsByOrder.get(row.id) ?? [],
    ...(relations.paymentDetailsByOrder.get(row.id) === undefined
      ? {}
      : { paymentDetails: relations.paymentDetailsByOrder.get(row.id) }),
  });
}

function toStaffOrder(row: OrderRow, relations: OrderRelations): StaffOrder {
  return staffOrderSchema.parse({
    ...baseOrder(row, relations),
    customer: {
      id: row.customerId,
      fullName: row.customerFullName,
      email: row.customerEmail,
      ...(row.customerPhone === null ? {} : { phone: row.customerPhone }),
    },
    statusEvents: relations.eventsByOrder.get(row.id) ?? [],
    ...(row.cancellationReason === null
      ? {}
      : { cancellationReason: row.cancellationReason }),
  });
}

export class PostgresOrderRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  async listCurrentCustomer(
    organizationId: string,
    customerId: string,
    params: CurrentCustomerOrderListParams,
  ): Promise<OrderPage> {
    const pagination = resolvePagination(params);
    const values: unknown[] = [organizationId, customerId];
    const conditions = ["o.organization_id = $1", "o.customer_id = $2"];
    if (params.statuses !== undefined && params.statuses.length > 0) {
      conditions.push(
        `o.status = ANY(${addValue(values, params.statuses)}::text[])`,
      );
    }
    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const orderBy = {
      NEWEST: "o.created_at DESC, o.id ASC",
      OLDEST: "o.created_at ASC, o.id ASC",
      TOTAL_DESC: "o.total DESC, o.id ASC",
      TOTAL_ASC: "o.total ASC, o.id ASC",
    }[params.sort ?? "NEWEST"];
    const countValues = [...values];
    const limit = addValue(values, pagination.limit);
    const offset = addValue(values, pagination.offset);
    const [orders, count] = await Promise.all([
      this.#database.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} ${ORDER_FROM} ${whereSql}
         ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total FROM orders o ${whereSql}`,
        countValues,
      ),
    ]);
    const relations = await this.#loadRelations(
      this.#database,
      organizationId,
      orders.rows.map((order) => order.id),
      false,
    );
    const totalItems = count.rows[0]?.total ?? 0;
    return orderPageSchema.parse({
      items: orders.rows.map((row) => baseOrder(row, relations)),
      ...paginationMetadata(pagination, totalItems),
    });
  }

  async getCurrentCustomerById(
    organizationId: string,
    customerId: string,
    orderId: string,
  ): Promise<Order> {
    const row = await this.#getOrderRow(
      this.#database,
      organizationId,
      orderId,
      customerId,
    );
    const relations = await this.#loadRelations(
      this.#database,
      organizationId,
      [orderId],
      false,
    );
    return baseOrder(row, relations);
  }

  async listStaff(
    organizationId: string,
    params: StaffOrderListParams,
  ): Promise<StaffOrderPage> {
    const pagination = resolvePagination(params);
    const values: unknown[] = [organizationId];
    const conditions = ["o.organization_id = $1"];
    if (params.query !== undefined && params.query.length > 0) {
      const marker = addValue(values, `%${params.query}%`);
      conditions.push(
        `(o.order_number ILIKE ${marker} OR c.first_name ILIKE ${marker} ` +
          `OR c.last_name ILIKE ${marker} OR c.email ILIKE ${marker} ` +
          `OR EXISTS (
             SELECT 1 FROM order_items search_item
              WHERE search_item.organization_id = o.organization_id
                AND search_item.order_id = o.id
                AND (search_item.sku_snapshot ILIKE ${marker}
                  OR search_item.product_name_snapshot ILIKE ${marker})
           ))`,
      );
    }
    if (params.statuses !== undefined && params.statuses.length > 0) {
      conditions.push(
        `o.status = ANY(${addValue(values, params.statuses)}::text[])`,
      );
    }
    if (
      params.paymentStatuses !== undefined &&
      params.paymentStatuses.length > 0
    ) {
      conditions.push(
        `o.payment_status = ANY(${addValue(values, params.paymentStatuses)}::text[])`,
      );
    }
    if (
      params.paymentProviders !== undefined &&
      params.paymentProviders.length > 0
    ) {
      conditions.push(
        `EXISTS (
           SELECT 1 FROM payments filter_payment
            WHERE filter_payment.organization_id = o.organization_id
              AND filter_payment.order_id = o.id
              AND filter_payment.provider = ANY(${addValue(values, params.paymentProviders)}::text[])
         )`,
      );
    }
    if (
      params.fulfillmentMethods !== undefined &&
      params.fulfillmentMethods.length > 0
    ) {
      conditions.push(
        `o.fulfillment_type = ANY(${addValue(values, params.fulfillmentMethods)}::text[])`,
      );
    }
    if (params.dateFrom !== undefined) {
      conditions.push(
        `o.created_at >= (${addValue(values, params.dateFrom)}::date::timestamp
          AT TIME ZONE organization.timezone)`,
      );
    }
    if (params.dateTo !== undefined) {
      conditions.push(
        `o.created_at < ((${addValue(values, params.dateTo)}::date + 1)::timestamp
          AT TIME ZONE organization.timezone)`,
      );
    }
    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const orderBy = {
      QUEUE: `CASE o.status
        WHEN 'PENDING_PAYMENT' THEN 0
        WHEN 'PAID' THEN 1
        WHEN 'PREPARING' THEN 2
        WHEN 'READY' THEN 3
        WHEN 'CANCELLED' THEN 4
        WHEN 'REFUNDED' THEN 5
        WHEN 'COMPLETED' THEN 6
        ELSE 7 END ASC, o.created_at ASC, o.id ASC`,
      NEWEST: "o.created_at DESC, o.id ASC",
      OLDEST: "o.created_at ASC, o.id ASC",
      TOTAL_DESC: "o.total DESC, o.id ASC",
    }[params.sort ?? "QUEUE"];
    const countValues = [...values];
    const limit = addValue(values, pagination.limit);
    const offset = addValue(values, pagination.offset);
    const [orders, count] = await Promise.all([
      this.#database.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} ${ORDER_FROM} ${whereSql}
         ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total ${ORDER_FROM} ${whereSql}`,
        countValues,
      ),
    ]);
    const relations = await this.#loadRelations(
      this.#database,
      organizationId,
      orders.rows.map((order) => order.id),
      true,
    );
    const totalItems = count.rows[0]?.total ?? 0;
    return staffOrderPageSchema.parse({
      items: orders.rows.map((row) => toStaffOrder(row, relations)),
      ...paginationMetadata(pagination, totalItems),
    });
  }

  async getStaffById(
    organizationId: string,
    orderId: string,
  ): Promise<StaffOrder> {
    return this.#getStaffById(this.#database, organizationId, orderId);
  }

  async transitionStatus(
    executor: SqlExecutor,
    options: Readonly<{
      organizationId: string;
      orderId: string;
      actorUserId: string;
      input: OrderTransitionRequest;
      requestId: string;
    }>,
  ): Promise<StaffOrder> {
    const locked = await this.#lockOrder(
      executor,
      options.organizationId,
      options.orderId,
    );
    if (!canTransitionOrder(locked.status, options.input.toStatus)) {
      throw invalidTransition(locked.status, options.input.toStatus);
    }
    const before = await this.#getStaffById(
      executor,
      options.organizationId,
      options.orderId,
    );
    if (options.input.toStatus === "COMPLETED") {
      await consumeCommittedOrderReservations(executor, {
        organizationId: options.organizationId,
        orderId: options.orderId,
        actorUserId: options.actorUserId,
        requestId: options.requestId,
      });
    }
    await executor.query(
      `UPDATE orders
          SET status = $3,
              payment_status = CASE WHEN $3 = 'PAID' THEN 'PAID' ELSE payment_status END,
              completed_at = CASE WHEN $3 = 'COMPLETED' THEN now() ELSE completed_at END,
              updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, options.orderId, options.input.toStatus],
    );
    await executor.query(
      `INSERT INTO order_status_events
         (organization_id, order_id, from_status, to_status, actor_user_id,
          reason, occurred_at)
       VALUES ($1, $2, $3, $4, $5, NULL, now())`,
      [
        options.organizationId,
        options.orderId,
        locked.status,
        options.input.toStatus,
        options.actorUserId,
      ],
    );
    const after = await this.#getStaffById(
      executor,
      options.organizationId,
      options.orderId,
    );
    await writeAudit(executor, {
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      action: "order.status.transition",
      entityType: "Order",
      entityId: options.orderId,
      before,
      after,
      requestId: options.requestId,
    });
    if (options.input.toStatus === "READY") {
      await enqueueNotification(executor, {
        organizationId: options.organizationId,
        eventKey: `order.ready:${options.orderId}`,
        eventType: "order.ready",
        recipientEmail: locked.customerEmail,
        payload: {
          firstName: locked.customerFirstName,
          orderNumber: locked.orderNumber,
          ...(locked.pickupAddress === null
            ? {}
            : { pickupAddress: locked.pickupAddress }),
        },
      });
    }
    return after;
  }

  async cancel(
    executor: SqlExecutor,
    options: Readonly<{
      organizationId: string;
      orderId: string;
      actorUserId: string;
      input: OrderCancellationRequest;
      requestId: string;
    }>,
  ): Promise<StaffOrder> {
    const locked = await this.#lockOrder(
      executor,
      options.organizationId,
      options.orderId,
    );
    if (!canCancelOrder(locked.status)) {
      throw invalidTransition(locked.status, "CANCELLED");
    }
    if (options.input.reason.length > 1_000) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "El motivo de cancelación supera el límite de persistencia.",
        fieldErrors: {
          "body.reason": ["El motivo no puede superar 1000 caracteres."],
        },
      });
    }
    const before = await this.#getStaffById(
      executor,
      options.organizationId,
      options.orderId,
    );
    await releaseOrderReservations(executor, {
      organizationId: options.organizationId,
      orderId: options.orderId,
      requestId: options.requestId,
      reason: "cancelled",
    });
    await executor.query(
      `UPDATE payments SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
        WHERE organization_id = $1 AND order_id = $2
          AND status NOT IN ('APPROVED', 'REFUNDED')`,
      [options.organizationId, options.orderId],
    );
    await executor.query(
      `UPDATE payment_attempts attempt SET status = 'CANCELLED', completed_at = now(), updated_at = now()
        FROM payments payment
       WHERE attempt.organization_id = $1
         AND payment.organization_id = attempt.organization_id
         AND payment.id = attempt.payment_id AND payment.order_id = $2
         AND attempt.status NOT IN ('APPROVED', 'REFUNDED')`,
      [options.organizationId, options.orderId],
    );
    await executor.query(
      `UPDATE orders SET status = 'CANCELLED', updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, options.orderId],
    );
    await executor.query(
      `INSERT INTO order_status_events
         (organization_id, order_id, from_status, to_status, actor_user_id,
          reason, occurred_at)
       VALUES ($1, $2, $3, 'CANCELLED', $4, $5, now())`,
      [
        options.organizationId,
        options.orderId,
        locked.status,
        options.actorUserId,
        options.input.reason,
      ],
    );
    const after = await this.#getStaffById(
      executor,
      options.organizationId,
      options.orderId,
    );
    await writeAudit(executor, {
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      action: "order.cancel",
      entityType: "Order",
      entityId: options.orderId,
      before,
      after,
      requestId: options.requestId,
    });
    await enqueueNotification(executor, {
      organizationId: options.organizationId,
      eventKey: `order.cancelled:${options.orderId}`,
      eventType: "order.cancelled",
      recipientEmail: locked.customerEmail,
      payload: {
        firstName: locked.customerFirstName,
        orderNumber: locked.orderNumber,
      },
    });
    return after;
  }

  async #getStaffById(
    executor: SqlExecutor,
    organizationId: string,
    orderId: string,
  ): Promise<StaffOrder> {
    const row = await this.#getOrderRow(executor, organizationId, orderId);
    const relations = await this.#loadRelations(
      executor,
      organizationId,
      [orderId],
      true,
    );
    return toStaffOrder(row, relations);
  }

  async #getOrderRow(
    executor: SqlExecutor,
    organizationId: string,
    orderId: string,
    customerId?: string,
  ): Promise<OrderRow> {
    const result = await executor.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} ${ORDER_FROM}
        WHERE o.organization_id = $1 AND o.id = $2
          ${customerId === undefined ? "" : "AND o.customer_id = $3"}
        LIMIT 1`,
      customerId === undefined
        ? [organizationId, orderId]
        : [organizationId, orderId, customerId],
    );
    const row = result.rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async #lockOrder(
    executor: SqlExecutor,
    organizationId: string,
    orderId: string,
  ): Promise<LockedOrderRow> {
    const result = await executor.query<LockedOrderRow>(
      `SELECT orders.id, orders.status,
              orders.order_number AS "orderNumber",
              customer.email AS "customerEmail",
              customer.first_name AS "customerFirstName",
              settings.pickup_address AS "pickupAddress"
         FROM orders
         JOIN customers customer
           ON customer.organization_id = orders.organization_id
          AND customer.id = orders.customer_id
         LEFT JOIN organization_settings settings
           ON settings.organization_id = orders.organization_id
        WHERE orders.organization_id = $1 AND orders.id = $2
        FOR UPDATE OF orders`,
      [organizationId, orderId],
    );
    const row = result.rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async #loadRelations(
    executor: SqlExecutor,
    organizationId: string,
    orderIds: readonly string[],
    includeEvents: boolean,
  ): Promise<OrderRelations> {
    if (orderIds.length === 0) {
      return {
        itemsByOrder: new Map(),
        eventsByOrder: new Map(),
        packageIdsByOrder: new Map(),
        paymentDetailsByOrder: new Map(),
      };
    }
    const items = await executor.query<OrderItemRow>(
      `SELECT item.id, item.order_id AS "orderId",
              item.product_id AS "productId", item.sku_snapshot AS sku,
              item.product_name_snapshot AS name, product.image_url AS "imageUrl",
              item.quantity, item.unit_price AS "unitPrice",
              item.line_total AS "lineTotal"
         FROM order_items item
         JOIN products product
           ON product.organization_id = item.organization_id
          AND product.id = item.product_id
        WHERE item.organization_id = $1
          AND item.order_id = ANY($2::uuid[])
        ORDER BY item.order_id ASC, item.id ASC`,
      [organizationId, orderIds],
    );
    const packages = await executor.query<OrderPackageRow>(
      `SELECT order_id AS "orderId", id AS "packageId"
         FROM packages
        WHERE organization_id = $1 AND order_id = ANY($2::uuid[])
        ORDER BY order_id ASC, created_at ASC, id ASC`,
      [organizationId, orderIds],
    );
    const events = includeEvents
      ? await executor.query<OrderStatusEventRow>(
          `SELECT event.id, event.order_id AS "orderId",
                  event.from_status AS "fromStatus", event.to_status AS "toStatus",
                  event.occurred_at AS "occurredAt",
                  COALESCE(event.actor_user_id, event.organization_id) AS "actorId",
                  CASE WHEN actor.id IS NULL THEN 'Sistema'
                       ELSE concat_ws(' ', actor.first_name, actor.last_name)
                   END AS "actorName",
                  event.reason
             FROM order_status_events event
             LEFT JOIN users actor ON actor.id = event.actor_user_id
            WHERE event.organization_id = $1
              AND event.order_id = ANY($2::uuid[])
            ORDER BY event.order_id ASC, event.occurred_at ASC, event.id ASC`,
          [organizationId, orderIds],
        )
      : { rows: [] as OrderStatusEventRow[] };
    const payments = await executor.query<PaymentRow>(
      `SELECT order_id AS "orderId", id, provider, status, amount, currency,
              provider_external_reference AS "providerExternalReference",
              provider_payment_id AS "providerPaymentId",
              provider_status AS "providerStatus",
              provider_status_detail AS "providerStatusDetail",
              approved_at AS "approvedAt", cancelled_at AS "cancelledAt",
              refunded_at AS "refundedAt", last_reconciled_at AS "lastReconciledAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM payments
        WHERE organization_id = $1 AND order_id = ANY($2::uuid[])`,
      [organizationId, orderIds],
    );
    const paymentIds = payments.rows.map((payment) => payment.id);
    const attempts = paymentIds.length === 0
      ? { rows: [] as PaymentAttemptRow[] }
      : await executor.query<PaymentAttemptRow>(
          `SELECT payment_id AS "paymentId", id,
                  attempt_number AS "attemptNumber", status,
                  provider_order_id AS "providerOrderId",
                  provider_preference_id AS "providerPreferenceId",
                  checkout_url AS "checkoutUrl", error_code AS "errorCode",
                  error_message AS "errorMessage", started_at AS "startedAt",
                  completed_at AS "completedAt", created_at AS "createdAt",
                  updated_at AS "updatedAt"
             FROM payment_attempts
            WHERE organization_id = $1 AND payment_id = ANY($2::uuid[])
            ORDER BY payment_id ASC, attempt_number ASC`,
          [organizationId, paymentIds],
        );
    const refunds = paymentIds.length === 0
      ? { rows: [] as RefundRow[] }
      : await executor.query<RefundRow>(
          `SELECT payment_id AS "paymentId", id, status, amount, reason,
                  actor_user_id AS "requestedByUserId",
                  provider_refund_id AS "providerRefundId",
                  requested_at AS "requestedAt", completed_at AS "completedAt",
                  created_at AS "createdAt", updated_at AS "updatedAt"
             FROM refunds
            WHERE organization_id = $1 AND payment_id = ANY($2::uuid[])`,
          [organizationId, paymentIds],
        );
    const attemptsByPayment = groupRows(
      attempts.rows,
      (row) => row.paymentId,
      toPaymentAttempt,
    );
    const refundByPayment = new Map(
      refunds.rows.map((row) => [row.paymentId, toRefund(row)] as const),
    );
    const paymentDetailsByOrder = new Map<string, PaymentDetails>();
    for (const payment of payments.rows) {
      paymentDetailsByOrder.set(payment.orderId, {
        payment: toPayment(payment),
        attempts: [...(attemptsByPayment.get(payment.id) ?? [])],
        ...(refundByPayment.get(payment.id) === undefined
          ? {}
          : { refund: refundByPayment.get(payment.id) }),
      });
    }
    return {
      itemsByOrder: groupRows(items.rows, (row) => row.orderId, toOrderItem),
      eventsByOrder: groupRows(
        events.rows,
        (row) => row.orderId,
        toStatusEvent,
      ),
      packageIdsByOrder: groupRows(
        packages.rows,
        (row) => row.orderId,
        (row) => row.packageId,
      ),
      paymentDetailsByOrder,
    };
  }
}
