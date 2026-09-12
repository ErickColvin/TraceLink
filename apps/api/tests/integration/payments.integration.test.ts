import { randomUUID } from "node:crypto";

import {
  authSessionEnvelopeSchema,
  checkoutResponseSchema,
  orderSchema,
  staffOrderPageSchema,
} from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import {
  createPostgresDatabase,
  type PostgresDatabase,
} from "../../src/database/index.js";
import { FakePaymentProvider } from "../../src/modules/payments/fake-payment-provider.js";
import { PaymentReconciliationJob } from "../../src/modules/payments/payment-reconciliation-job.js";
import { FakeNotificationProvider } from "../../src/modules/notifications/fake-notification-provider.js";
import {
  enqueueNotification,
  NotificationOutboxProcessor,
} from "../../src/modules/notifications/notification-outbox.js";
import {
  NotificationProviderError,
  type NotificationProvider,
} from "../../src/modules/notifications/notification-provider.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required.");

const config = createTestConfig({ databaseUrl });
const unique = randomUUID().slice(0, 8);
const webhookSecret = "test-webhook-secret";
let database: PostgresDatabase;
let app: ReturnType<typeof createApp>;
let customerAgent: ReturnType<typeof request.agent>;
let customerCsrf = "";
let organizationId = "";
let productId = "";
let paymentProvider: FakePaymentProvider;

type IdRow = Readonly<{ id: string }>;

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  paymentProvider = new FakePaymentProvider({
    checkoutBaseUrl: `${config.webOrigin}/checkout/resultado?status=pending`,
    webhookSecret,
    scenario: "pending",
  });
  app = createApp({
    config: { ...config, mercadoPagoWebhookSecret: webhookSecret },
    database,
    readinessCheck: () => database.readinessCheck(),
    paymentProvider,
  });
  customerAgent = request.agent(app);

  const registration = await customerAgent
    .post("/api/v1/auth/register")
    .set("Origin", config.webOrigin)
    .send({
      firstName: "Pago",
      lastName: "Cliente",
      email: `payments-${unique}@example.com`,
      password: "Customer-Test-Password-123!",
      phone: "+56911112222",
    });
  const envelope = authSessionEnvelopeSchema.parse(registration.body);
  customerCsrf = envelope.csrfToken;
  organizationId = envelope.session.organization.id;

  await database.sqlTransaction(async (executor) => {
    const category = await executor.query<IdRow>(
      `INSERT INTO categories
         (organization_id, slug, name, active, created_at, updated_at)
       VALUES ($1, $2, 'Pagos integracion', true, now(), now())
       RETURNING id`,
      [organizationId, `payments-${unique}`],
    );
    const location = await executor.query<IdRow>(
      `INSERT INTO inventory_locations
         (organization_id, code, name, active, created_at, updated_at)
       VALUES ($1, $2, 'Bodega pagos', true, now(), now())
       RETURNING id`,
      [organizationId, `PAY-${unique}`],
    );
    const product = await executor.query<IdRow>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, published, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Producto pago', 4321, 0, true, true, now(), now())
       RETURNING id`,
      [
        organizationId,
        category.rows[0]?.id,
        `PAY-SKU-${unique}`,
        `pay-product-${unique}`,
      ],
    );
    productId = product.rows[0]?.id ?? "";
    await executor.query(
      `INSERT INTO inventory_balances
         (organization_id, product_id, location_id, physical_quantity,
          reserved_quantity, updated_at)
       VALUES ($1, $2, $3, 2, 0, now())`,
      [organizationId, productId, location.rows[0]?.id],
    );
  });
});

afterAll(async () => {
  await database.close();
});

describe("checkout payments against PostgreSQL", () => {
  it("creates an authoritative pending order, reserves inventory and reconciles a signed webhook once", async () => {
    const createCheckout = () =>
      customerAgent
        .post("/api/v1/checkout")
        .set("Origin", config.webOrigin)
        .set("X-CSRF-Token", customerCsrf)
        .set("Idempotency-Key", `checkout-${unique}`)
        .send({
          fulfillmentMethod: "PICKUP",
          items: [{ productId, quantity: 1 }],
          notes: "Retiro en tienda.",
        });

    const created = await createCheckout();
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const checkout = checkoutResponseSchema.parse(created.body);
    expect(checkout.order.total).toBe(4321);
    expect(checkout.order.status).toBe("PENDING_PAYMENT");
    expect(checkout.payment.status).toBe("PENDING");
    expect(checkout.attempt.checkoutUrl).toContain("provider_order_id=");

    const staffAgent = request.agent(app);
    const staffLogin = await staffAgent
      .post("/api/v1/auth/login")
      .set("Origin", config.webOrigin)
      .send({
        audience: "staff",
        email: "admin@chmarket.test",
        password: "Admin-Test-Password-123!",
      });
    expect(staffLogin.status).toBe(200);
    const providerFiltered = await staffAgent.get(
      "/api/v1/staff/orders?paymentProviders=FAKE&pageSize=100",
    );
    expect(providerFiltered.status, JSON.stringify(providerFiltered.body)).toBe(200);
    expect(
      staffOrderPageSchema.parse(providerFiltered.body).items.map((order) => order.id),
    ).toContain(checkout.order.id);

    const replay = await createCheckout();
    expect(replay.status).toBe(201);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(replay.body).toEqual(created.body);

    const reserved = await database.query<Readonly<{ reserved: number }>>(
      `SELECT reserved_quantity::integer AS reserved
         FROM inventory_balances
        WHERE organization_id = $1 AND product_id = $2`,
      [organizationId, productId],
    );
    expect(reserved.rows[0]?.reserved).toBe(1);

    const providerOrderId = checkout.attempt.providerOrderId;
    expect(providerOrderId).toBeDefined();
    paymentProvider.setOrderStatus(providerOrderId ?? "", "APPROVED");
    const providerRequestId = `mp-request-${unique}`;
    const webhook = () =>
      request(app)
        .post("/api/v1/webhooks/mercadopago")
        .set("x-request-id", providerRequestId)
        .set("x-signature", paymentProvider.signWebhook(providerOrderId ?? "", providerRequestId))
        .send({
          id: `event-${unique}`,
          type: "order",
          action: "order.updated",
          data: { id: providerOrderId },
        });

    const firstWebhook = await webhook();
    expect(firstWebhook.status, JSON.stringify(firstWebhook.body)).toBe(200);
    expect(firstWebhook.body.received).toBe(true);

    const duplicateWebhook = await webhook();
    expect(duplicateWebhook.status).toBe(200);

    const detail = await customerAgent.get(`/api/v1/me/orders/${checkout.order.id}`);
    expect(detail.status).toBe(200);
    const order = orderSchema.parse(detail.body);
    expect(order.status).toBe("PAID");
    expect(order.paymentStatus).toBe("PAID");
    expect(order.paymentDetails?.payment.status).toBe("APPROVED");

    const events = await database.query<Readonly<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM payment_provider_events
        WHERE provider = 'FAKE' AND provider_event_id = $1`,
      [`event-${unique}`],
    );
    expect(events.rows[0]?.count).toBe(1);

    const outboxEvents = await database.query<Readonly<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM outbox_events
        WHERE organization_id = $1
          AND event_key = $2`,
      [organizationId, `order.payment.approved:${checkout.payment.id}`],
    );
    expect(outboxEvents.rows[0]?.count).toBe(1);

    const notificationProvider = new FakeNotificationProvider();
    const outbox = new NotificationOutboxProcessor(database, notificationProvider);
    const delivery = await outbox.process({ limit: 100, leaseMinutes: 10 });
    expect(delivery).toMatchObject({ retrying: 0, dead: 0 });
    const deliveredKeys = notificationProvider.messages.map(
      (message) => message.idempotencyKey,
    );
    expect(deliveredKeys).toContain(`order.created:${checkout.order.id}`);
    expect(deliveredKeys).toContain(
      `order.payment.approved:${checkout.payment.id}`,
    );
  });

  it("rejects unauthenticated checkout and non-pickup fulfillment", async () => {
    const anonymous = await request(app)
      .post("/api/v1/checkout")
      .set("Origin", config.webOrigin)
      .set("Idempotency-Key", `anonymous-${unique}`)
      .send({ fulfillmentMethod: "PICKUP", items: [{ productId, quantity: 1 }] });
    expect(anonymous.status).toBe(401);

    const delivery = await customerAgent
      .post("/api/v1/checkout")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", customerCsrf)
      .set("Idempotency-Key", `delivery-${unique}`)
      .send({ fulfillmentMethod: "DELIVERY", items: [{ productId, quantity: 1 }] });
    expect(delivery.status).toBe(400);
  });

  it("reconciles a bounded pending payment when its webhook is lost", async () => {
    const created = await customerAgent
      .post("/api/v1/checkout")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", customerCsrf)
      .set("Idempotency-Key", `reconciliation-${unique}`)
      .send({
        fulfillmentMethod: "PICKUP",
        items: [{ productId, quantity: 1 }],
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const checkout = checkoutResponseSchema.parse(created.body);
    const providerOrderId = checkout.attempt.providerOrderId ?? "";
    paymentProvider.setOrderStatus(providerOrderId, "APPROVED");

    const job = new PaymentReconciliationJob(database, paymentProvider);
    const first = await job.run({
      limit: 10,
      minAgeMinutes: 0,
      maxAgeHours: 24,
    });
    expect(first).toMatchObject({ processed: 1, failed: 0 });

    const detail = await customerAgent.get(
      `/api/v1/me/orders/${checkout.order.id}`,
    );
    expect(detail.status).toBe(200);
    const order = orderSchema.parse(detail.body);
    expect(order.status).toBe("PAID");
    expect(order.paymentDetails?.payment.status).toBe("APPROVED");

    const audit = await database.query<Readonly<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM audit_logs
        WHERE organization_id = $1
          AND entity_id = $2
          AND action = 'payment.reconciliation.process'`,
      [organizationId, checkout.payment.id],
    );
    expect(audit.rows[0]?.count).toBe(1);

    const repeat = await job.run({
      limit: 10,
      minAgeMinutes: 0,
      maxAgeHours: 24,
    });
    expect(repeat.selected).toBe(0);
  });

  it("retries outbox delivery without rolling back the domain event", async () => {
    const eventKey = `order.ready:retry-${unique}`;
    await enqueueNotification(database, {
      organizationId,
      eventKey,
      eventType: "order.ready",
      recipientEmail: `retry-${unique}@example.com`,
      payload: { firstName: "Retry", orderNumber: `CH-${unique}` },
    });
    const unavailableProvider: NotificationProvider = {
      code: "FAKE",
      sendEmail: () => Promise.reject(new NotificationProviderError({
        code: "TEST_PROVIDER_UNAVAILABLE",
        message: "Provider unavailable in test.",
        retryable: true,
      })),
    };
    const failingProcessor = new NotificationOutboxProcessor(
      database,
      unavailableProvider,
    );
    const failed = await failingProcessor.process({ limit: 100, leaseMinutes: 10 });
    expect(failed.retrying).toBeGreaterThanOrEqual(1);

    const queued = await database.query<Readonly<{
      status: string;
      attempts: number;
      lastError: string | null;
    }>>(
      `SELECT status, attempts, last_error AS "lastError"
         FROM outbox_events
        WHERE organization_id = $1 AND event_key = $2`,
      [organizationId, eventKey],
    );
    expect(queued.rows[0]).toEqual({
      status: "PENDING",
      attempts: 1,
      lastError: "TEST_PROVIDER_UNAVAILABLE",
    });

    await database.query(
      `UPDATE outbox_events SET next_attempt_at = now() - interval '1 second'
        WHERE organization_id = $1 AND event_key = $2`,
      [organizationId, eventKey],
    );
    const recoveredProvider = new FakeNotificationProvider();
    const recovered = await new NotificationOutboxProcessor(
      database,
      recoveredProvider,
    ).process({ limit: 100, leaseMinutes: 10 });
    expect(recovered.delivered).toBeGreaterThanOrEqual(1);
    expect(recoveredProvider.messages.map((entry) => entry.idempotencyKey))
      .toContain(eventKey);
  });
});
