import { randomUUID } from "node:crypto";

import {
  authSessionEnvelopeSchema,
  dashboardOverviewSchema,
  operationalReportSchema,
} from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createPostgresDatabase, type PostgresDatabase } from "../../src/database/index.js";
import { hashPassword } from "../../src/shared/security/password.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required.");

const config = createTestConfig({ databaseUrl });
const unique = randomUUID().slice(0, 8);
let database: PostgresDatabase;
let app: ReturnType<typeof createApp>;
let adminAgent: ReturnType<typeof request.agent>;
let limitedAgent: ReturnType<typeof request.agent>;
let organizationId = "";
let actorUserId = "";
let currentDate = "";
let criticalBalanceId = "";
let expiringBalanceId = "";
let delayedOrderId = "";
let storedPackageId = "";
let incidentPackageId = "";

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  app = createApp({ config, database, readinessCheck: () => database.readinessCheck() });
  adminAgent = request.agent(app);
  limitedAgent = request.agent(app);

  const login = await adminAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: "admin@chmarket.test",
      password: "Admin-Test-Password-123!",
    });
  const session = authSessionEnvelopeSchema.parse(login.body);
  organizationId = session.session.organization.id;
  actorUserId = session.session.user.id;

  const context = await database.query<Readonly<{ currentDate: string }>>(
    `SELECT (now() AT TIME ZONE timezone)::date::text AS "currentDate"
       FROM organizations WHERE id = $1`,
    [organizationId],
  );
  currentDate = context.rows[0]?.currentDate ?? "";

  const limitedEmail = `reports-limited-${unique}@example.com`;
  const passwordHash = await hashPassword("Reports-Test-Password-123!");
  await database.sqlTransaction(async (executor) => {
    const role = await executor.query<Readonly<{ id: string }>>(
      `SELECT id FROM roles WHERE organization_id = $1 AND code = 'OPERATIONS'`,
      [organizationId],
    );
    const user = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO users
         (email, email_normalized, first_name, last_name, password_hash,
          status, updated_at)
       VALUES ($1, $1, 'Consulta', 'Limitada', $2, 'ACTIVE', now()) RETURNING id`,
      [limitedEmail, passwordHash],
    );
    await executor.query(
      `INSERT INTO memberships
         (organization_id, user_id, role_id, status, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now())`,
      [organizationId, user.rows[0]?.id, role.rows[0]?.id],
    );
  });
  await limitedAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: limitedEmail,
      password: "Reports-Test-Password-123!",
    })
    .expect(200);

  await database.sqlTransaction(async (executor) => {
    await executor.query(
      `INSERT INTO organization_settings
         (organization_id, contact_email, contact_phone, pickup_address,
          pickup_instructions, low_stock_threshold, package_alert_days,
          expiration_warning_days, updated_at)
       VALUES ($1, 'reportes@chmarket.test', '+56900000000', 'Sucursal reportes',
               'Presentar identificación', 5, 5, 14, now())
       ON CONFLICT (organization_id) DO UPDATE
         SET low_stock_threshold = 5, package_alert_days = 5,
             expiration_warning_days = 14, updated_at = now()`,
      [organizationId],
    );
    const category = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO categories (organization_id, slug, name, active, updated_at)
       VALUES ($1, $2, 'Métricas', true, now()) RETURNING id`,
      [organizationId, `metrics-${unique}`],
    );
    const location = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_locations
         (organization_id, code, name, active, updated_at)
       VALUES ($1, $2, 'Bodega métricas', true, now()) RETURNING id`,
      [organizationId, `MET-${unique}`],
    );
    const criticalProduct = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, published, active, updated_at)
       VALUES ($1, $2, $3, $4, 'Producto crítico', 1990, 5, true, true, now())
       RETURNING id`,
      [organizationId, category.rows[0]?.id, `CRIT-${unique}`, `critical-${unique}`],
    );
    const criticalBalance = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_balances
         (organization_id, product_id, location_id, physical_quantity,
          reserved_quantity, updated_at)
       VALUES ($1, $2, $3, 2, 0, now()) RETURNING id`,
      [organizationId, criticalProduct.rows[0]?.id, location.rows[0]?.id],
    );
    criticalBalanceId = criticalBalance.rows[0]?.id ?? "";

    const expiringProduct = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, published, active, updated_at)
       VALUES ($1, $2, $3, $4, 'Producto por vencer', 2990, 1, true, true, now())
       RETURNING id`,
      [organizationId, category.rows[0]?.id, `EXP-${unique}`, `expiring-${unique}`],
    );
    const lot = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_lots
         (organization_id, product_id, lot_number, expiration_date)
       VALUES ($1, $2, $3, CURRENT_DATE + 3) RETURNING id`,
      [organizationId, expiringProduct.rows[0]?.id, `EXP-LOT-${unique}`],
    );
    const expiringBalance = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO inventory_balances
         (organization_id, product_id, location_id, lot_id,
          physical_quantity, reserved_quantity, updated_at)
       VALUES ($1, $2, $3, $4, 20, 0, now()) RETURNING id`,
      [
        organizationId,
        expiringProduct.rows[0]?.id,
        location.rows[0]?.id,
        lot.rows[0]?.id,
      ],
    );
    expiringBalanceId = expiringBalance.rows[0]?.id ?? "";

    const customer = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO customers
         (organization_id, first_name, last_name, email, email_normalized,
          status, updated_at)
       VALUES ($1, 'Cliente', 'Métricas', $2, $2, 'ACTIVE', now()) RETURNING id`,
      [organizationId, `metrics-${unique}@example.com`],
    );
    const order = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO orders
         (organization_id, customer_id, order_number, status, payment_status,
          fulfillment_type, subtotal, discount, shipping, total,
          estimated_ready_at, updated_at)
       VALUES ($1, $2, $3, 'PREPARING', 'PAID', 'PICKUP', 12345, 0, 0,
               12345, now() - interval '2 hours', now()) RETURNING id`,
      [organizationId, customer.rows[0]?.id, `METRIC-${unique}`],
    );
    delayedOrderId = order.rows[0]?.id ?? "";

    const storedPackage = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO packages
         (organization_id, customer_id, tracking_code, carrier, description,
          item_count, requires_cold_storage, storage_location_id, status,
          received_at, stored_at, updated_at)
       VALUES ($1, $2, $3, 'Métricas', 'Almacenado', 1, false, $4, 'STORED',
               now() - interval '10 days', now() - interval '10 days', now())
       RETURNING id`,
      [organizationId, customer.rows[0]?.id, `STORED-${unique}`, location.rows[0]?.id],
    );
    storedPackageId = storedPackage.rows[0]?.id ?? "";
    const incidentPackage = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO packages
         (organization_id, customer_id, tracking_code, carrier, description,
          item_count, requires_cold_storage, status, updated_at)
       VALUES ($1, $2, $3, 'Métricas', 'Incidente', 1, false, 'INCIDENT', now())
       RETURNING id`,
      [organizationId, customer.rows[0]?.id, `INCIDENT-${unique}`],
    );
    incidentPackageId = incidentPackage.rows[0]?.id ?? "";
    await executor.query(
      `INSERT INTO tracking_events
         (organization_id, package_id, previous_status, new_status,
          description, actor_user_id, occurred_at)
       VALUES ($1, $2, 'RECEIVED', 'INCIDENT', 'Revisión operativa requerida',
               $3, now())`,
      [organizationId, incidentPackageId, actorUserId],
    );

    const foreignOrganization = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO organizations
         (name, slug, locale, currency, timezone, active, updated_at)
       VALUES ('Tenant métricas ajeno', $1, 'es-CL', 'CLP',
               'America/Santiago', true, now()) RETURNING id`,
      [`metrics-foreign-${unique}`],
    );
    const foreignCustomer = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO customers
         (organization_id, first_name, last_name, email, email_normalized,
          status, updated_at)
       VALUES ($1, 'Cliente', 'Ajeno', $2, $2, 'ACTIVE', now()) RETURNING id`,
      [foreignOrganization.rows[0]?.id, `metrics-foreign-${unique}@example.com`],
    );
    await executor.query(
      `INSERT INTO orders
         (organization_id, customer_id, order_number, status, payment_status,
          fulfillment_type, subtotal, discount, shipping, total, updated_at)
       VALUES ($1, $2, $3, 'COMPLETED', 'PAID', 'PICKUP', 900000, 0, 0,
               900000, now())`,
      [
        foreignOrganization.rows[0]?.id,
        foreignCustomer.rows[0]?.id,
        `FOREIGN-METRIC-${unique}`,
      ],
    );
  });
});

afterAll(async () => {
  await database.close();
});

describe("dashboard and reports against PostgreSQL", () => {
  it("derives tenant KPIs, trend and typed operational alerts", async () => {
    const response = await adminAgent.get("/api/v1/staff/dashboard");
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const overview = dashboardOverviewSchema.parse(response.body);
    expect(overview.kpis.salesTodayClp).toBeGreaterThanOrEqual(12_345);
    expect(overview.kpis.salesTodayClp).toBeLessThan(900_000);
    expect(overview.kpis.pendingOrders).toBeGreaterThanOrEqual(1);
    expect(overview.kpis.storedPackages).toBeGreaterThanOrEqual(1);
    expect(overview.kpis.criticalStockItems).toBeGreaterThanOrEqual(1);
    expect(overview.kpis.expiringSoonItems).toBeGreaterThanOrEqual(1);
    expect(overview.salesTrend.some(
      (point) => point.date === currentDate && point.salesClp >= 12_345,
    )).toBe(true);
    expect(overview.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "CRITICAL_STOCK",
        inventoryItemId: criticalBalanceId,
      }),
      expect.objectContaining({
        type: "EXPIRING_BATCH",
        inventoryItemId: expiringBalanceId,
      }),
      expect.objectContaining({ type: "DELAYED_ORDER", orderId: delayedOrderId }),
      expect.objectContaining({
        type: "PACKAGE_STORED_TOO_LONG",
        packageId: storedPackageId,
      }),
      expect.objectContaining({
        type: "PACKAGE_INCIDENT",
        packageId: incidentPackageId,
      }),
    ]));
  });

  it("allows every active staff member to view dashboard but gates reports", async () => {
    const dashboard = await limitedAgent.get("/api/v1/staff/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboardOverviewSchema.safeParse(dashboard.body).success).toBe(true);

    const reports = await limitedAgent.get("/api/v1/staff/reports");
    expect(reports.status).toBe(403);
    expect(reports.body.error.code).toBe("FORBIDDEN");
  });

  it("builds filtered reports and exact summaries from tenant records", async () => {
    const response = await adminAgent.get(
      `/api/v1/staff/reports?from=${currentDate}&to=${currentDate}`,
    );
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const report = operationalReportSchema.parse(response.body);
    expect(report.items.some(
      (item) => item.category === "SALES" && (item.amountClp ?? 0) >= 12_345,
    )).toBe(true);
    expect(report.items.some(
      (item) => item.category === "ORDERS" && item.reference === "PREPARING",
    )).toBe(true);
    expect(report.items.some(
      (item) => item.category === "PACKAGES" && item.reference === "INCIDENT",
    )).toBe(true);
    expect(report.summary.records).toBe(report.items.length);
    expect(report.summary.quantity).toBe(
      report.items.reduce((total, item) => total + item.quantity, 0),
    );
    expect(report.summary.amountClp).toBe(
      report.items.reduce((total, item) => total + (item.amountClp ?? 0), 0),
    );

    const filtered = await adminAgent.get(
      `/api/v1/staff/reports?from=${currentDate}&to=${currentDate}&category=SALES`,
    );
    const sales = operationalReportSchema.parse(filtered.body);
    expect(sales.items.length).toBeGreaterThan(0);
    expect(sales.items.every((item) => item.category === "SALES")).toBe(true);
    expect(sales.summary.amountClp).toBeLessThan(900_000);
  });

  it("rejects inverted and excessive report ranges", async () => {
    const inverted = await adminAgent.get(
      "/api/v1/staff/reports?from=2026-09-03&to=2026-09-02",
    );
    expect(inverted.status).toBe(400);

    const excessive = await adminAgent.get(
      "/api/v1/staff/reports?from=2024-01-01&to=2026-09-02",
    );
    expect(excessive.status).toBe(400);
    expect(excessive.body.error.code).toBe("VALIDATION_ERROR");
  });
});
