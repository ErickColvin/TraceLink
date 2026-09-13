import { randomUUID } from "node:crypto";

import {
  authSessionEnvelopeSchema,
  customerSchema,
  productPageSchema,
  productSchema,
  staffCustomerDetailSchema,
} from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createPostgresDatabase, type PostgresDatabase } from "../../src/database/index.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required.");

const config = createTestConfig({ databaseUrl });
let database: PostgresDatabase;
let app: ReturnType<typeof createApp>;
let staffAgent: ReturnType<typeof request.agent>;
let customerAgent: ReturnType<typeof request.agent>;
let staffCsrf = "";
let customerCsrf = "";
let organizationId = "";
let categoryId = "";
let productId = "";
let customerId = "";
let foreignProductId = "";
const unique = randomUUID().slice(0, 8);

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  app = createApp({ config, database, readinessCheck: () => database.readinessCheck() });
  staffAgent = request.agent(app);
  customerAgent = request.agent(app);

  const organization = await database.query<Readonly<{ id: string }>>(
    "SELECT id FROM organizations WHERE slug = 'ch-market'",
  );
  organizationId = organization.rows[0]?.id ?? "";
  const category = await database.query<Readonly<{ id: string }>>(
    `INSERT INTO categories
       (organization_id, slug, name, description, active, created_at, updated_at)
     VALUES ($1, $2, 'Integración', 'Categoría de prueba', true, now(), now())
     RETURNING id`,
    [organizationId, `integration-${unique}`],
  );
  categoryId = category.rows[0]?.id ?? "";

  const login = await staffAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: "admin@chmarket.test",
      password: "Admin-Test-Password-123!",
    });
  staffCsrf = authSessionEnvelopeSchema.parse(login.body).csrfToken;

  const registration = await customerAgent
    .post("/api/v1/auth/register")
    .set("Origin", config.webOrigin)
    .send({
      firstName: "Cliente",
      lastName: "Comercio",
      email: `commerce-${unique}@example.com`,
      password: "Customer-Test-Password-123!",
      phone: "+56911112222",
    });
  const customerEnvelope = authSessionEnvelopeSchema.parse(registration.body);
  customerCsrf = customerEnvelope.csrfToken;
  customerId = customerEnvelope.session.audience === "customer"
    ? customerEnvelope.session.customer.id
    : "";

  const created = await staffAgent
    .post("/api/v1/staff/products")
    .set("Origin", config.webOrigin)
    .set("X-CSRF-Token", staffCsrf)
    .send({
      sku: `sku-${unique}`,
      slug: `producto-${unique}`,
      name: "Producto integración",
      description: "Producto persistido",
      categoryId,
      salePrice: 1990,
      minimumStock: 3,
      published: true,
      active: true,
    });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  productId = productSchema.parse(created.body).id;

  const foreign = await database.sqlTransaction(async (executor) => {
    const otherOrganization = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO organizations
         (name, slug, locale, currency, timezone, active, updated_at)
       VALUES ('Otro tenant', $1, 'es-CL', 'CLP', 'America/Santiago', true, now())
       RETURNING id`,
      [`other-${unique}`],
    );
    const otherOrganizationId = otherOrganization.rows[0]?.id ?? "";
    const otherCategory = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO categories (organization_id, slug, name, active, updated_at)
       VALUES ($1, 'otros', 'Otros', true, now()) RETURNING id`,
      [otherOrganizationId],
    );
    const product = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO products
         (organization_id, category_id, sku, slug, name, sale_price,
          minimum_stock, published, active, updated_at)
       VALUES ($1, $2, 'FOREIGN', 'foreign', 'Producto ajeno', 1000, 0, true,
               true, now())
       RETURNING id`,
      [otherOrganizationId, otherCategory.rows[0]?.id],
    );
    return product.rows[0]?.id ?? "";
  });
  foreignProductId = foreign;
});

afterAll(async () => {
  await database.close();
});

describe("products and customers against PostgreSQL", () => {
  it("serves the persisted public catalog and tenant-scoped staff detail", async () => {
    const publicPage = await request(app).get("/api/v1/products");
    expect(publicPage.status).toBe(200);
    const page = productPageSchema.parse(publicPage.body);
    expect(page.items.some((product) => product.id === productId)).toBe(true);

    const detail = await staffAgent.get(`/api/v1/staff/products/${productId}`);
    expect(detail.status).toBe(200);
    expect(productSchema.parse(detail.body).sku).toBe(`SKU-${unique.toUpperCase()}`);

    const foreignDetail = await staffAgent.get(
      `/api/v1/staff/products/${foreignProductId}`,
    );
    expect(foreignDetail.status).toBe(404);
  });

  it("validates CSRF/strict input, conflicts, status rules, and audit", async () => {
    const missingCsrf = await staffAgent
      .patch(`/api/v1/staff/products/${productId}/active`)
      .set("Origin", config.webOrigin)
      .send({ active: false });
    expect(missingCsrf.status).toBe(403);

    const invalid = await staffAgent
      .patch(`/api/v1/staff/products/${productId}/active`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .send({ active: true, organizationId });
    expect(invalid.status).toBe(400);

    const duplicate = await staffAgent
      .post("/api/v1/staff/products")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .send({
        sku: `sku-${unique}`,
        slug: `duplicate-${unique}`,
        name: "Duplicado",
        categoryId,
        salePrice: 1,
        published: false,
        active: true,
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.fieldErrors.sku).toBeDefined();

    const disabled = await staffAgent
      .patch(`/api/v1/staff/products/${productId}/active`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .send({ active: false });
    expect(productSchema.parse(disabled.body).published).toBe(false);

    const invalidPublication = await staffAgent
      .patch(`/api/v1/staff/products/${productId}/publication`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .send({ published: true });
    expect(invalidPublication.status).toBe(409);

    const audit = await database.query<Readonly<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count FROM audit_logs
        WHERE organization_id = $1 AND entity_type = 'Product' AND entity_id = $2`,
      [organizationId, productId],
    );
    expect(audit.rows[0]?.count).toBeGreaterThanOrEqual(2);
  });

  it("derives customer ownership from the session and persists profile changes", async () => {
    const profile = await customerAgent.get("/api/v1/me/profile");
    expect(profile.status).toBe(200);
    expect(customerSchema.parse(profile.body).id).toBe(customerId);

    const updated = await customerAgent
      .patch("/api/v1/me/profile")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", customerCsrf)
      .send({
        firstName: "Cliente",
        lastName: "Actualizado",
        email: `contact-${unique}@example.com`,
        phone: "+56933334444",
        address: {
          line1: "Calle 123",
          commune: "Santiago",
          city: "Santiago",
          region: "Metropolitana",
        },
      });
    expect(updated.status).toBe(200);
    expect(customerSchema.parse(updated.body).lastName).toBe("Actualizado");

    const staffDetail = await staffAgent.get(
      `/api/v1/staff/customers/${customerId}`,
    );
    expect(staffDetail.status).toBe(200);
    const detail = staffCustomerDetailSchema.parse(staffDetail.body);
    expect(detail.customer.email).toBe(`contact-${unique}@example.com`);
    expect(detail.activity.some((event) => event.kind === "PROFILE_UPDATED")).toBe(true);
  });
});
