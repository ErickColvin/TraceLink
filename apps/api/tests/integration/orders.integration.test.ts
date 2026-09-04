import { randomUUID } from "node:crypto";

import {
  authSessionEnvelopeSchema,
  orderPageSchema,
  orderSchema,
  staffOrderPageSchema,
  staffOrderSchema,
} from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import {
  createPostgresDatabase,
  type PostgresDatabase,
  type SqlExecutor,
} from "../../src/database/index.js";
import { hashPassword } from "../../src/shared/security/password.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required.");

const config = createTestConfig({ databaseUrl });
const unique = randomUUID().slice(0, 8);
let database: PostgresDatabase;
let app: ReturnType<typeof createApp>;
let staffAgent: ReturnType<typeof request.agent>;
let salesAgent: ReturnType<typeof request.agent>;
let customerAgent: ReturnType<typeof request.agent>;
let otherCustomerAgent: ReturnType<typeof request.agent>;
let staffCsrf = "";
let salesCsrf = "";
let customerId = "";
let otherCustomerId = "";
let organizationId = "";
let staffUserId = "";
let productId = "";
let primaryOrderId = "";
let cancellableOrderId = "";
let completedOrderId = "";
let otherCustomerOrderId = "";
let foreignOrderId = "";

type IdRow = Readonly<{ id: string }>;

async function insertOrder(
  executor: SqlExecutor,
  options: Readonly<{
    organizationId: string;
    customerId: string;
    productId: string;
    actorUserId: string;
    suffix: string;
    status?: "PENDING_PAYMENT" | "PAID" | "PREPARING" | "READY" | "COMPLETED";
    paymentStatus?: "PENDING" | "PAID";
    fulfillmentMethod?: "PICKUP" | "DELIVERY";
  }>,
): Promise<string> {
  const status = options.status ?? "PENDING_PAYMENT";
  const paymentStatus = options.paymentStatus ??
    (status === "PENDING_PAYMENT" ? "PENDING" : "PAID");
  const order = await executor.query<IdRow>(
    `INSERT INTO orders
       (organization_id, customer_id, order_number, status, payment_status,
        fulfillment_type, subtotal, discount, shipping, total, notes,
        completed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 5990, 500, 1000, 6490,
             'Pedido de integración',
             CASE WHEN $4 = 'COMPLETED' THEN now() ELSE NULL END,
             now(), now())
     RETURNING id`,
    [
      options.organizationId,
      options.customerId,
      `ORD-${unique}-${options.suffix}`,
      status,
      paymentStatus,
      options.fulfillmentMethod ?? "PICKUP",
    ],
  );
  const orderId = order.rows[0]?.id;
  if (orderId === undefined) throw new Error("Order fixture returned no id.");
  await executor.query(
    `INSERT INTO order_items
       (organization_id, order_id, product_id, sku_snapshot,
        product_name_snapshot, unit_price, quantity, line_total)
     VALUES ($1, $2, $3, $4, 'Producto snapshot', 2995, 2, 5990)`,
    [options.organizationId, orderId, options.productId, `SKU-${unique}`],
  );
  await executor.query(
    `INSERT INTO order_status_events
       (organization_id, order_id, from_status, to_status, actor_user_id,
        occurred_at)
     VALUES ($1, $2, NULL, $3, $4, now())`,
    [options.organizationId, orderId, status, options.actorUserId],
  );
  return orderId;
}

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  app = createApp({
    config,
    database,
    readinessCheck: () => database.readinessCheck(),
  });
  staffAgent = request.agent(app);
  salesAgent = request.agent(app);
  customerAgent = request.agent(app);
  otherCustomerAgent = request.agent(app);

  const staffLogin = await staffAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: "admin@chmarket.test",
      password: "Admin-Test-Password-123!",
    });
  const staffEnvelope = authSessionEnvelopeSchema.parse(staffLogin.body);
  staffCsrf = staffEnvelope.csrfToken;
  organizationId = staffEnvelope.session.organization.id;
  staffUserId = staffEnvelope.session.user.id;

  const registerCustomer = async (
    agent: ReturnType<typeof request.agent>,
    prefix: string,
  ): Promise<string> => {
    const registration = await agent
      .post("/api/v1/auth/register")
      .set("Origin", config.webOrigin)
      .send({
        firstName: prefix,
        lastName: "Pedidos",
        email: `${prefix.toLowerCase()}-${unique}@example.com`,
        password: "Customer-Test-Password-123!",
        phone: "+56911112222",
      });
    const envelope = authSessionEnvelopeSchema.parse(registration.body);
    if (envelope.session.audience !== "customer") {
      throw new Error("Customer fixture did not create a customer session.");
    }
    return envelope.session.customer.id;
  };
  customerId = await registerCustomer(customerAgent, "Owner");
  otherCustomerId = await registerCustomer(otherCustomerAgent, "Other");

  const salesPassword = "Sales-Test-Password-123!";
  const salesPasswordHash = await hashPassword(salesPassword);
  const salesEmail = `sales-orders-${unique}@example.com`;
  await database.sqlTransaction(async (executor) => {
    await executor.query(
      `INSERT INTO organization_settings
         (organization_id, contact_email, contact_phone, pickup_address,
          pickup_instructions, low_stock_threshold, package_alert_days,
          expiration_warning_days, created_at, updated_at)
       VALUES ($1, 'contacto@chmarket.test', '+56900000000',
               'Sucursal CH Market Huechuraba', 'Presentar identificación',
               5, 5, 30, now(), now())
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId],
    );
    const category = await executor.query<IdRow>(
      `INSERT INTO categories
         (organization_id, slug, name, active, created_at, updated_at)
       VALUES ($1, $2, 'Pedidos integración', true, now(), now())
       RETURNING id`,
      [organizationId, `orders-${unique}`],
    );
    const product = await executor.query<IdRow>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, image_url, published, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Producto actual', 2995, 0,
               'https://example.com/product.jpg', true, true, now(), now())
       RETURNING id`,
      [
        organizationId,
        category.rows[0]?.id,
        `ORD-SKU-${unique}`,
        `order-product-${unique}`,
      ],
    );
    productId = product.rows[0]?.id ?? "";

    primaryOrderId = await insertOrder(executor, {
      organizationId,
      customerId,
      productId,
      actorUserId: staffUserId,
      suffix: "primary",
    });
    cancellableOrderId = await insertOrder(executor, {
      organizationId,
      customerId,
      productId,
      actorUserId: staffUserId,
      suffix: "cancel",
      status: "PREPARING",
    });
    completedOrderId = await insertOrder(executor, {
      organizationId,
      customerId,
      productId,
      actorUserId: staffUserId,
      suffix: "complete",
      status: "COMPLETED",
    });
    otherCustomerOrderId = await insertOrder(executor, {
      organizationId,
      customerId: otherCustomerId,
      productId,
      actorUserId: staffUserId,
      suffix: "other",
      fulfillmentMethod: "DELIVERY",
    });
    await executor.query(
      `INSERT INTO packages
         (organization_id, customer_id, order_id, tracking_code, carrier,
          description, item_count, requires_cold_storage, status,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Carrier test', 'Paquete del pedido', 1,
               false, 'EXPECTED', now(), now())`,
      [organizationId, customerId, primaryOrderId, `PKG-${unique}`],
    );

    const salesUser = await executor.query<IdRow>(
      `INSERT INTO users
         (email, email_normalized, first_name, last_name, password_hash,
          status, created_at, updated_at)
       VALUES ($1, $1, 'Ventas', 'Pedidos', $2, 'ACTIVE', now(), now())
       RETURNING id`,
      [salesEmail, salesPasswordHash],
    );
    const salesRole = await executor.query<IdRow>(
      `SELECT id FROM roles
        WHERE organization_id = $1 AND code = 'SALES'`,
      [organizationId],
    );
    await executor.query(
      `INSERT INTO memberships
         (organization_id, user_id, role_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now(), now())`,
      [organizationId, salesUser.rows[0]?.id, salesRole.rows[0]?.id],
    );

    const foreignOrganization = await executor.query<IdRow>(
      `INSERT INTO organizations
         (name, slug, locale, currency, timezone, active, created_at, updated_at)
       VALUES ('Tenant pedidos ajeno', $1, 'es-CL', 'CLP',
               'America/Santiago', true, now(), now())
       RETURNING id`,
      [`orders-foreign-${unique}`],
    );
    const foreignOrganizationId = foreignOrganization.rows[0]?.id ?? "";
    const foreignCustomer = await executor.query<IdRow>(
      `INSERT INTO customers
         (organization_id, first_name, last_name, email, email_normalized,
          status, created_at, updated_at)
       VALUES ($1, 'Cliente', 'Ajeno', $2, $2, 'ACTIVE', now(), now())
       RETURNING id`,
      [foreignOrganizationId, `foreign-${unique}@example.com`],
    );
    const foreignCategory = await executor.query<IdRow>(
      `INSERT INTO categories
         (organization_id, slug, name, active, created_at, updated_at)
       VALUES ($1, 'orders', 'Orders', true, now(), now())
       RETURNING id`,
      [foreignOrganizationId],
    );
    const foreignProduct = await executor.query<IdRow>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, published, active, created_at, updated_at)
       VALUES ($1, $2, 'ORDER-FOREIGN', 'order-foreign', 'Producto ajeno',
               1000, 0, true, true, now(), now())
       RETURNING id`,
      [foreignOrganizationId, foreignCategory.rows[0]?.id],
    );
    foreignOrderId = await insertOrder(executor, {
      organizationId: foreignOrganizationId,
      customerId: foreignCustomer.rows[0]?.id ?? "",
      productId: foreignProduct.rows[0]?.id ?? "",
      actorUserId: staffUserId,
      suffix: "foreign",
    });
  });

  const salesLogin = await salesAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({ audience: "staff", email: salesEmail, password: salesPassword });
  salesCsrf = authSessionEnvelopeSchema.parse(salesLogin.body).csrfToken;
});

afterAll(async () => {
  await database.close();
});

describe("orders against PostgreSQL", () => {
  it("derives customer ownership from the session and hides every foreign scope", async () => {
    const list = await customerAgent.get(
      "/api/v1/me/orders?statuses=PENDING_PAYMENT&statuses=PREPARING&pageSize=10",
    );
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    const page = orderPageSchema.parse(list.body);
    expect(page.items.map((order) => order.id)).toContain(primaryOrderId);
    expect(page.items.map((order) => order.id)).toContain(cancellableOrderId);
    expect(page.items.map((order) => order.id)).not.toContain(otherCustomerOrderId);
    expect(page.items[0]?.items[0]?.name).toBe("Producto snapshot");

    const detail = await customerAgent.get(`/api/v1/me/orders/${primaryOrderId}`);
    expect(detail.status).toBe(200);
    const order = orderSchema.parse(detail.body);
    expect(order.customerId).toBe(customerId);
    expect(order.pickupLocation).toBe("Sucursal CH Market Huechuraba");
    expect(order.packageIds).toHaveLength(1);

    const otherOwner = await customerAgent.get(
      `/api/v1/me/orders/${otherCustomerOrderId}`,
    );
    const otherTenant = await customerAgent.get(
      `/api/v1/me/orders/${foreignOrderId}`,
    );
    expect(otherOwner.status).toBe(404);
    expect(otherTenant.status).toBe(404);
  });

  it("lists the operational queue with persisted filters and tenant isolation", async () => {
    const list = await staffAgent.get(
      `/api/v1/staff/orders?query=ORD-${unique}&paymentStatuses=PENDING` +
        "&fulfillmentMethods=PICKUP&sort=QUEUE&pageSize=10",
    );
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    const page = staffOrderPageSchema.parse(list.body);
    expect(page.items.map((order) => order.id)).toContain(primaryOrderId);
    expect(page.items.every((order) => order.customer.id.length > 0)).toBe(true);
    expect(page.items.every((order) => order.statusEvents.length > 0)).toBe(true);

    const foreign = await staffAgent.get(`/api/v1/staff/orders/${foreignOrderId}`);
    expect(foreign.status).toBe(404);
  });

  it("serializes transitions, rejects skips, and replays one committed mutation", async () => {
    const skipped = await staffAgent
      .post(`/api/v1/staff/orders/${primaryOrderId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `order-skip-${unique}`)
      .send({ toStatus: "PREPARING" });
    expect(skipped.status).toBe(409);
    expect(skipped.body.error.code).toBe("INVALID_STATE_TRANSITION");

    const requestId = `order-transition-${unique}`;
    const transition = () =>
      staffAgent
        .post(`/api/v1/staff/orders/${primaryOrderId}/transitions`)
        .set("Origin", config.webOrigin)
        .set("X-CSRF-Token", staffCsrf)
        .set("X-Request-ID", requestId)
        .set("Idempotency-Key", `order-paid-${unique}`)
        .send({ toStatus: "PAID" });
    const first = await transition();
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const transitioned = staffOrderSchema.parse(first.body);
    expect(transitioned.status).toBe("PAID");
    expect(transitioned.paymentStatus).toBe("PAID");
    expect(transitioned.statusEvents.at(-1)?.fromStatus).toBe("PENDING_PAYMENT");

    const replay = await transition();
    expect(replay.status).toBe(200);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(replay.body).toEqual(first.body);

    const conflict = await staffAgent
      .post(`/api/v1/staff/orders/${primaryOrderId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `order-paid-${unique}`)
      .send({ toStatus: "PREPARING" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");

    const persisted = await database.query<Readonly<{ events: number; audits: number }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM order_status_events
           WHERE organization_id = $1 AND order_id = $2) AS events,
         (SELECT COUNT(*)::integer FROM audit_logs
           WHERE organization_id = $1 AND entity_type = 'Order'
             AND entity_id = $2 AND action = 'order.status.transition'
             AND request_id = $3) AS audits`,
      [organizationId, primaryOrderId, requestId],
    );
    expect(persisted.rows[0]).toEqual({ events: 2, audits: 1 });
  });

  it("cancels only eligible orders and persists the reason once", async () => {
    const cancel = () =>
      staffAgent
        .post(`/api/v1/staff/orders/${cancellableOrderId}/cancellation`)
        .set("Origin", config.webOrigin)
        .set("X-CSRF-Token", staffCsrf)
        .set("Idempotency-Key", `order-cancel-${unique}`)
        .send({ reason: "Solicitud confirmada por el cliente." });
    const first = await cancel();
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const cancelled = staffOrderSchema.parse(first.body);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancellationReason).toBe(
      "Solicitud confirmada por el cliente.",
    );
    expect(cancelled.statusEvents.at(-1)?.reason).toBe(
      "Solicitud confirmada por el cliente.",
    );

    const replay = await cancel();
    expect(replay.status).toBe(200);
    expect(replay.headers["idempotency-replayed"]).toBe("true");

    const terminal = await staffAgent
      .post(`/api/v1/staff/orders/${completedOrderId}/cancellation`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `order-terminal-${unique}`)
      .send({ reason: "Intento sobre pedido ya completado." });
    expect(terminal.status).toBe(409);
    expect(terminal.body.error.code).toBe("INVALID_STATE_TRANSITION");
  });

  it("enforces CSRF, idempotency headers, audience, and separate permissions", async () => {
    const missingKey = await staffAgent
      .post(`/api/v1/staff/orders/${otherCustomerOrderId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .send({ toStatus: "PAID" });
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const missingCsrf = await staffAgent
      .post(`/api/v1/staff/orders/${otherCustomerOrderId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("Idempotency-Key", `missing-csrf-${unique}`)
      .send({ toStatus: "PAID" });
    expect(missingCsrf.status).toBe(403);

    const customerStaffRoute = await customerAgent.get("/api/v1/staff/orders");
    expect(customerStaffRoute.status).toBe(403);

    const salesCanTransition = await salesAgent
      .post(`/api/v1/staff/orders/${otherCustomerOrderId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", salesCsrf)
      .set("Idempotency-Key", `sales-transition-${unique}`)
      .send({ toStatus: "PAID" });
    expect(salesCanTransition.status, JSON.stringify(salesCanTransition.body)).toBe(200);

    const salesCannotCancel = await salesAgent
      .post(`/api/v1/staff/orders/${otherCustomerOrderId}/cancellation`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", salesCsrf)
      .set("Idempotency-Key", `sales-cancel-${unique}`)
      .send({ reason: "No debe autorizarse para ventas." });
    expect(salesCannotCancel.status).toBe(403);
    expect(salesCannotCancel.body.error.code).toBe("FORBIDDEN");
  });
});
