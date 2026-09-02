import { randomUUID } from "node:crypto";

import {
  authSessionEnvelopeSchema,
  inventoryItemSchema,
  inventoryMovementPageSchema,
  inventoryMovementSchema,
  inventoryPageSchema,
} from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createPostgresDatabase, type PostgresDatabase } from "../../src/database/index.js";
import { InventoryReservationService } from "../../src/modules/inventory/inventory-reservation-service.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import { hashPassword } from "../../src/shared/security/password.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required.");

const config = createTestConfig({ databaseUrl });
const unique = randomUUID().slice(0, 8);
const movementBody = {
  type: "ADJUSTMENT",
  quantity: 4,
  adjustmentDirection: "INCREASE",
  reason: "Conteo de integración",
} as const;

let database: PostgresDatabase;
let app: ReturnType<typeof createApp>;
let adminAgent: ReturnType<typeof request.agent>;
let operationsAgent: ReturnType<typeof request.agent>;
let csrfToken = "";
let operationsCsrf = "";
let organizationId = "";
let actorUserId = "";
let productId = "";
let locationId = "";
let lotId = "";
let balanceId = "";
let foreignBalanceId = "";

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  app = createApp({ config, database, readinessCheck: () => database.readinessCheck() });
  adminAgent = request.agent(app);
  operationsAgent = request.agent(app);

  const organization = await database.query<Readonly<{ id: string }>>(
    "SELECT id FROM organizations WHERE slug = 'ch-market'",
  );
  organizationId = organization.rows[0]?.id ?? "";
  const adminLogin = await adminAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: "admin@chmarket.test",
      password: "Admin-Test-Password-123!",
    });
  const adminSession = authSessionEnvelopeSchema.parse(adminLogin.body);
  csrfToken = adminSession.csrfToken;
  actorUserId = adminSession.session.user.id;

  const fixture = await database.sqlTransaction(async (executor) => {
    const category = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO categories (organization_id, slug, name, active, updated_at)
       VALUES ($1, $2, 'Inventario integración', true, now()) RETURNING id`,
      [organizationId, `inventory-${unique}`],
    );
    const product = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, published, active, updated_at)
       VALUES ($1, $2, $3, $4, 'Producto inventario', 2990, 3, true, true, now())
       RETURNING id`,
      [organizationId, category.rows[0]?.id, `INV-${unique}`, `inv-${unique}`],
    );
    const location = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_locations
         (organization_id, code, name, active, updated_at)
       VALUES ($1, $2, 'Bodega integración', true, now()) RETURNING id`,
      [organizationId, `BOD-${unique}`],
    );
    const lot = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_lots
         (organization_id, product_id, lot_number, expiration_date)
       VALUES ($1, $2, $3, CURRENT_DATE + 30) RETURNING id`,
      [organizationId, product.rows[0]?.id, `LOT-${unique}`],
    );
    const balance = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_balances
         (organization_id, product_id, location_id, lot_id,
          physical_quantity, reserved_quantity, updated_at)
       VALUES ($1, $2, $3, $4, 10, 0, now()) RETURNING id`,
      [organizationId, product.rows[0]?.id, location.rows[0]?.id, lot.rows[0]?.id],
    );
    return {
      productId: product.rows[0]?.id ?? "",
      locationId: location.rows[0]?.id ?? "",
      lotId: lot.rows[0]?.id ?? "",
      balanceId: balance.rows[0]?.id ?? "",
    };
  });
  productId = fixture.productId;
  locationId = fixture.locationId;
  lotId = fixture.lotId;
  balanceId = fixture.balanceId;

  foreignBalanceId = await database.sqlTransaction(async (executor) => {
    const organization = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO organizations
         (name, slug, locale, currency, timezone, active, updated_at)
       VALUES ('Tenant inventario', $1, 'es-CL', 'CLP', 'America/Santiago', true, now())
       RETURNING id`,
      [`inventory-foreign-${unique}`],
    );
    const foreignOrganizationId = organization.rows[0]?.id ?? "";
    const category = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO categories (organization_id, slug, name, active, updated_at)
       VALUES ($1, 'general', 'General', true, now()) RETURNING id`,
      [foreignOrganizationId],
    );
    const product = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, published, active, updated_at)
       VALUES ($1, $2, 'FOREIGN-INV', 'foreign-inv', 'Ajeno', 1000, 0,
               true, true, now()) RETURNING id`,
      [foreignOrganizationId, category.rows[0]?.id],
    );
    const location = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_locations
         (organization_id, code, name, active, updated_at)
       VALUES ($1, 'FOREIGN', 'Bodega ajena', true, now()) RETURNING id`,
      [foreignOrganizationId],
    );
    const balance = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_balances
         (organization_id, product_id, location_id, physical_quantity,
          reserved_quantity, updated_at)
       VALUES ($1, $2, $3, 100, 0, now()) RETURNING id`,
      [foreignOrganizationId, product.rows[0]?.id, location.rows[0]?.id],
    );
    return balance.rows[0]?.id ?? "";
  });

  const operationsEmail = `operations-${unique}@example.com`;
  const passwordHash = await hashPassword("Operations-Test-Password-123!");
  await database.sqlTransaction(async (executor) => {
    const user = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO users
         (email, email_normalized, first_name, last_name, password_hash, status, updated_at)
       VALUES ($1, $1, 'Operaciones', 'Sin Inventario', $2, 'ACTIVE', now())
       RETURNING id`,
      [operationsEmail, passwordHash],
    );
    const role = await executor.query<Readonly<{ id: string }>>(
      `SELECT id FROM roles WHERE organization_id = $1 AND code = 'OPERATIONS'`,
      [organizationId],
    );
    await executor.query(
      `INSERT INTO memberships
         (organization_id, user_id, role_id, status, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now())`,
      [organizationId, user.rows[0]?.id, role.rows[0]?.id],
    );
  });
  const operationsLogin = await operationsAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: operationsEmail,
      password: "Operations-Test-Password-123!",
    });
  operationsCsrf = authSessionEnvelopeSchema.parse(operationsLogin.body).csrfToken;
});

afterAll(async () => {
  await database.close();
});

describe("inventory ledger and reservations against PostgreSQL", () => {
  it("lists only tenant stock and persists immutable movement snapshots", async () => {
    const pageResponse = await adminAgent.get("/api/v1/staff/inventory");
    expect(pageResponse.status).toBe(200);
    const page = inventoryPageSchema.parse(pageResponse.body);
    expect(page.items.some((item) => item.id === balanceId)).toBe(true);

    const detail = await adminAgent.get(`/api/v1/staff/inventory/${balanceId}`);
    expect(detail.status).toBe(200);
    expect(inventoryItemSchema.parse(detail.body).physicalStock).toBe(10);
    expect((await adminAgent.get(`/api/v1/staff/inventory/${foreignBalanceId}`)).status)
      .toBe(404);

    const response = await adminAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Idempotency-Key", `inventory-adjust-${unique}`)
      .send({ inventoryItemId: balanceId, ...movementBody });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const movement = inventoryMovementSchema.parse(response.body);
    expect(movement.before.physicalStock).toBe(10);
    expect(movement.after.physicalStock).toBe(14);
    expect(movement.quantityDelta).toBe(4);

    const history = await adminAgent.get(
      `/api/v1/staff/inventory/movements?inventoryItemId=${balanceId}`,
    );
    expect(history.status).toBe(200);
    expect(inventoryMovementPageSchema.parse(history.body).items[0]?.id).toBe(
      movement.id,
    );
  });

  it("requires CSRF/idempotency, replays safely, and rolls conflicts back", async () => {
    const body = {
      inventoryItemId: balanceId,
      ...movementBody,
      quantity: 2,
      reason: "Idempotencia",
    };
    const missingCsrf = await adminAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("Idempotency-Key", `csrf-${unique}`)
      .send(body);
    expect(missingCsrf.status).toBe(403);

    const missingKey = await adminAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send(body);
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const key = `replay-${unique}`;
    const first = await adminAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Idempotency-Key", key)
      .send(body);
    const replay = await adminAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Idempotency-Key", key)
      .send(body);
    expect(replay.status).toBe(201);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(replay.body.id).toBe(first.body.id);

    const conflict = await adminAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Idempotency-Key", key)
      .send({ ...body, quantity: 3 });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");

    const excessive = await adminAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Idempotency-Key", `excess-${unique}`)
      .send({
        inventoryItemId: balanceId,
        type: "DAMAGE",
        quantity: 1_000,
        adjustmentDirection: "DECREASE",
        reason: "Daño total",
      });
    expect(excessive.status).toBe(409);
    expect(excessive.body.error.code).toBe("INSUFFICIENT_STOCK");

    const rows = await database.query<Readonly<{ physicalQuantity: number }>>(
      `SELECT physical_quantity AS "physicalQuantity"
         FROM inventory_balances WHERE organization_id = $1 AND id = $2`,
      [organizationId, balanceId],
    );
    expect(rows.rows[0]?.physicalQuantity).toBe(16);
  });

  it("enforces inventory.adjust independently from inventory visibility", async () => {
    const forbidden = await operationsAgent
      .post("/api/v1/staff/inventory/movements")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", operationsCsrf)
      .set("Idempotency-Key", `forbidden-${unique}`)
      .send({ inventoryItemId: balanceId, ...movementBody });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  it("serializes competing reservations and releases/consumes lifecycle state", async () => {
    const reservationService = new InventoryReservationService(database);
    const expiration = new Date(Date.now() + 60 * 60 * 1_000);
    const attempts = await Promise.allSettled([
      reservationService.create({
        organizationId,
        actorUserId,
        productId,
        locationId,
        lotId,
        quantity: 10,
        expiresAt: expiration,
        requestId: `reservation-a-${unique}`,
      }),
      reservationService.create({
        organizationId,
        actorUserId,
        productId,
        locationId,
        lotId,
        quantity: 10,
        expiresAt: expiration,
        requestId: `reservation-b-${unique}`,
      }),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    const rejected = attempts.filter((attempt) => attempt.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejection = rejected[0];
    expect(rejection?.status).toBe("rejected");
    if (rejection?.status === "rejected") {
      expect(rejection.reason).toBeInstanceOf(AppError);
    }
    const reservation = fulfilled[0];
    if (reservation?.status !== "fulfilled") throw new Error("Expected reservation.");

    const released = await reservationService.release({
      organizationId,
      actorUserId,
      reservationId: reservation.value.id,
      requestId: `release-${unique}`,
    });
    expect(released.status).toBe("RELEASED");

    const consumable = await reservationService.create({
      organizationId,
      actorUserId,
      productId,
      locationId,
      lotId,
      quantity: 2,
      expiresAt: expiration,
      requestId: `reservation-consume-${unique}`,
    });
    const consumed = await reservationService.consume({
      organizationId,
      actorUserId,
      reservationId: consumable.id,
      requestId: `consume-${unique}`,
    });
    expect(consumed.status).toBe("CONSUMED");
    const balance = await database.query<
      Readonly<{ physicalQuantity: number; reservedQuantity: number }>
    >(
      `SELECT physical_quantity AS "physicalQuantity",
              reserved_quantity AS "reservedQuantity"
         FROM inventory_balances WHERE organization_id = $1 AND id = $2`,
      [organizationId, balanceId],
    );
    expect(balance.rows[0]).toMatchObject({
      physicalQuantity: 14,
      reservedQuantity: 0,
    });
  });

  it("expires due reservations atomically and audits every mutation", async () => {
    const reservationService = new InventoryReservationService(database);
    const reservation = await reservationService.create({
      organizationId,
      actorUserId,
      productId,
      locationId,
      lotId,
      quantity: 1,
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
      requestId: `reservation-expiry-${unique}`,
    });
    await database.query(
      `UPDATE inventory_reservations
          SET created_at = now() - interval '2 hours',
              expires_at = now() - interval '1 hour'
        WHERE organization_id = $1 AND id = $2`,
      [organizationId, reservation.id],
    );
    const expired = await reservationService.expireDue({
      organizationId,
      requestId: `expire-${unique}`,
    });
    expect(expired.some((entry) => entry.id === reservation.id)).toBe(true);

    const audit = await database.query<Readonly<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count FROM audit_logs
        WHERE organization_id = $1
          AND entity_type IN ('InventoryMovement', 'InventoryReservation')`,
      [organizationId],
    );
    expect(audit.rows[0]?.count).toBeGreaterThanOrEqual(8);
  });
});
