import { randomUUID } from "node:crypto";

import {
  authSessionEnvelopeSchema,
  organizationSettingsSchema,
  staffRoleDefinitionSchema,
  staffUserPageSchema,
  staffUserSchema,
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
let operatorAgent: ReturnType<typeof request.agent>;
let limitedAgent: ReturnType<typeof request.agent>;
let csrfToken = "";
let organizationId = "";
let adminMembershipId = "";
let operatorMembershipId = "";
let superAdminRoleId = "";
let salesRoleId = "";
let warehouseRoleId = "";
let foreignMembershipId = "";
let foreignRoleId = "";

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  app = createApp({ config, database, readinessCheck: () => database.readinessCheck() });
  adminAgent = request.agent(app);
  operatorAgent = request.agent(app);
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
  csrfToken = session.csrfToken;
  organizationId = session.session.organization.id;
  if (session.session.audience !== "staff") throw new Error("Expected staff session.");
  adminMembershipId = session.session.membership.id;

  const roles = await database.query<Readonly<{ id: string; code: string }>>(
    `SELECT id, code FROM roles
      WHERE organization_id = $1 AND code IN ('SUPER_ADMIN', 'SALES', 'WAREHOUSE')`,
    [organizationId],
  );
  superAdminRoleId = roles.rows.find((role) => role.code === "SUPER_ADMIN")?.id ?? "";
  salesRoleId = roles.rows.find((role) => role.code === "SALES")?.id ?? "";
  warehouseRoleId = roles.rows.find((role) => role.code === "WAREHOUSE")?.id ?? "";

  const operatorEmail = `admin-operator-${unique}@example.com`;
  const passwordHash = await hashPassword("Operator-Test-Password-123!");
  operatorMembershipId = await database.sqlTransaction(async (executor) => {
    const user = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO users
         (email, email_normalized, first_name, last_name, password_hash,
          status, updated_at)
       VALUES ($1, $1, 'Operador', 'Administración', $2, 'ACTIVE', now())
       RETURNING id`,
      [operatorEmail, passwordHash],
    );
    const role = await executor.query<Readonly<{ id: string }>>(
      `SELECT id FROM roles WHERE organization_id = $1 AND code = 'OPERATIONS'`,
      [organizationId],
    );
    const membership = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO memberships
         (organization_id, user_id, role_id, status, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now()) RETURNING id`,
      [organizationId, user.rows[0]?.id, role.rows[0]?.id],
    );
    return membership.rows[0]?.id ?? "";
  });
  const operatorLogin = await operatorAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: operatorEmail,
      password: "Operator-Test-Password-123!",
    });
  expect(operatorLogin.status).toBe(200);

  const limitedEmail = `admin-limited-${unique}@example.com`;
  await database.sqlTransaction(async (executor) => {
    const user = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO users
         (email, email_normalized, first_name, last_name, password_hash,
          status, updated_at)
       VALUES ($1, $1, 'Personal', 'Limitado', $2, 'ACTIVE', now())
       RETURNING id`,
      [limitedEmail, passwordHash],
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
  await limitedAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: limitedEmail,
      password: "Operator-Test-Password-123!",
    })
    .expect(200);

  const foreign = await database.sqlTransaction(async (executor) => {
    const tenant = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO organizations
         (name, slug, locale, currency, timezone, active, updated_at)
       VALUES ('Tenant administración', $1, 'es-CL', 'CLP',
               'America/Santiago', true, now()) RETURNING id`,
      [`admin-foreign-${unique}`],
    );
    const foreignOrganizationId = tenant.rows[0]?.id ?? "";
    const role = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO roles
         (organization_id, code, label, description, system, updated_at)
       VALUES ($1, 'ADMIN', 'Administrador ajeno', 'Rol ajeno', true, now())
       RETURNING id`,
      [foreignOrganizationId],
    );
    const user = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO users
         (email, email_normalized, first_name, last_name, password_hash,
          status, updated_at)
       VALUES ($1, $1, 'Usuario', 'Ajeno', $2, 'ACTIVE', now()) RETURNING id`,
      [`admin-foreign-${unique}@example.com`, passwordHash],
    );
    const membership = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO memberships
         (organization_id, user_id, role_id, status, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now()) RETURNING id`,
      [foreignOrganizationId, user.rows[0]?.id, role.rows[0]?.id],
    );
    return {
      membershipId: membership.rows[0]?.id ?? "",
      roleId: role.rows[0]?.id ?? "",
    };
  });
  foreignMembershipId = foreign.membershipId;
  foreignRoleId = foreign.roleId;
});

afterAll(async () => {
  await database.close();
});

describe("tenant administration against PostgreSQL", () => {
  it("lists memberships by tenant and protects the final SUPER_ADMIN", async () => {
    const listResponse = await adminAgent.get("/api/v1/staff/users?pageSize=50");
    expect(listResponse.status, JSON.stringify(listResponse.body)).toBe(200);
    const page = staffUserPageSchema.parse(listResponse.body);
    expect(page.items.some((user) => user.id === adminMembershipId)).toBe(true);
    expect(page.items.some((user) => user.id === operatorMembershipId)).toBe(true);
    expect(page.items.some((user) => user.id === foreignMembershipId)).toBe(false);
    expect((await adminAgent.get(`/api/v1/staff/users/${foreignMembershipId}`)).status)
      .toBe(404);

    const lastSuperAdmin = await adminAgent
      .patch(`/api/v1/staff/users/${adminMembershipId}/access`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({ status: "INACTIVE", roleId: superAdminRoleId });
    expect(lastSuperAdmin.status).toBe(409);
    expect(lastSuperAdmin.body.error.code).toBe("CONFLICT");
    expect((await adminAgent.get("/api/v1/auth/me")).status).toBe(200);
  });

  it("validates tenant roles and revokes every session when access is disabled", async () => {
    const foreignRole = await adminAgent
      .patch(`/api/v1/staff/users/${operatorMembershipId}/access`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({ status: "ACTIVE", roleId: foreignRoleId });
    expect(foreignRole.status).toBe(404);

    const missingCsrf = await adminAgent
      .patch(`/api/v1/staff/users/${operatorMembershipId}/access`)
      .set("Origin", config.webOrigin)
      .send({ status: "INACTIVE", roleId: salesRoleId });
    expect(missingCsrf.status).toBe(403);

    const disabled = await adminAgent
      .patch(`/api/v1/staff/users/${operatorMembershipId}/access`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("X-Request-ID", `disable-member-${unique}`)
      .send({ status: "INACTIVE", roleId: salesRoleId });
    expect(disabled.status, JSON.stringify(disabled.body)).toBe(200);
    expect(staffUserSchema.parse(disabled.body)).toMatchObject({
      id: operatorMembershipId,
      status: "INACTIVE",
      roleId: salesRoleId,
    });
    expect((await operatorAgent.get("/api/v1/auth/me")).status).toBe(401);

    const persisted = await database.query<Readonly<{
      revoked: number;
      audits: number;
    }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM sessions
           WHERE organization_id = $1 AND membership_id = $2
             AND revoked_at IS NOT NULL) AS revoked,
         (SELECT COUNT(*)::integer FROM audit_logs
           WHERE organization_id = $1 AND entity_type = 'Membership'
             AND entity_id = $2 AND request_id = $3) AS audits`,
      [organizationId, operatorMembershipId, `disable-member-${unique}`],
    );
    expect(persisted.rows[0]).toEqual({ revoked: 1, audits: 1 });
  });

  it("updates role permissions atomically while protecting SUPER_ADMIN", async () => {
    const rolesResponse = await adminAgent.get("/api/v1/staff/roles");
    expect(rolesResponse.status).toBe(200);
    const roles = staffRoleDefinitionSchema.array().parse(rolesResponse.body);
    const warehouse = roles.find((role) => role.id === warehouseRoleId);
    if (warehouse === undefined) throw new Error("WAREHOUSE role fixture missing.");

    const protectedResponse = await adminAgent
      .put(`/api/v1/staff/roles/${superAdminRoleId}/permissions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({ permissions: ["products.view"] });
    expect(protectedResponse.status).toBe(409);

    const updatedResponse = await adminAgent
      .put(`/api/v1/staff/roles/${warehouseRoleId}/permissions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({ permissions: ["inventory.view", "inventory.adjust"] });
    expect(updatedResponse.status, JSON.stringify(updatedResponse.body)).toBe(200);
    expect(staffRoleDefinitionSchema.parse(updatedResponse.body).permissions).toEqual([
      "inventory.view",
      "inventory.adjust",
    ]);

    const restored = await adminAgent
      .put(`/api/v1/staff/roles/${warehouseRoleId}/permissions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({ permissions: warehouse.permissions });
    expect(restored.status).toBe(200);
    expect(staffRoleDefinitionSchema.parse(restored.body).permissions).toEqual(
      warehouse.permissions,
    );
    expect((await adminAgent.get(`/api/v1/staff/roles/${foreignRoleId}`)).status)
      .toBe(404);
  });

  it("persists validated organization settings without crossing tenants", async () => {
    const denied = await limitedAgent.get("/api/v1/staff/settings");
    expect(denied.status).toBe(403);

    const invalid = await adminAgent
      .put("/api/v1/staff/settings")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        organizationName: "CH Market",
        locale: "es-CL",
        currency: "CLP",
        timezone: "Zona/Que-No-Existe",
        contactEmail: "contacto@chmarket.test",
        contactPhone: "+56900000000",
        pickupAddress: "Dirección de retiro",
        pickupInstructions: "Presentar identificación.",
        lowStockThreshold: 5,
        packageAlertDays: 5,
        expirationWarningDays: 30,
      });
    expect(invalid.status).toBe(400);

    const pickupAddress = `Sucursal de integración ${"A".repeat(370)}`;
    const requestId = `settings-${unique}`;
    const updatedResponse = await adminAgent
      .put("/api/v1/staff/settings")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("X-Request-ID", requestId)
      .send({
        organizationName: "CH Market Integración",
        locale: "es-CL",
        currency: "clp",
        timezone: "America/Santiago",
        contactEmail: "operaciones@chmarket.test",
        contactPhone: "+56987654321",
        pickupAddress,
        pickupInstructions: "Presentar identificación y código de retiro.",
        lowStockThreshold: 7,
        packageAlertDays: 4,
        expirationWarningDays: 21,
      });
    expect(updatedResponse.status, JSON.stringify(updatedResponse.body)).toBe(200);
    const settings = organizationSettingsSchema.parse(updatedResponse.body);
    expect(settings).toMatchObject({
      organizationName: "CH Market Integración",
      currency: "CLP",
      pickupAddress,
      lowStockThreshold: 7,
    });

    const readBack = await adminAgent.get("/api/v1/staff/settings");
    expect(readBack.status).toBe(200);
    expect(organizationSettingsSchema.parse(readBack.body)).toEqual(settings);
    const audit = await database.query<Readonly<{ total: number }>>(
      `SELECT COUNT(*)::integer AS total FROM audit_logs
        WHERE organization_id = $1 AND entity_type = 'OrganizationSettings'
          AND request_id = $2`,
      [organizationId, requestId],
    );
    expect(audit.rows[0]?.total).toBe(1);
  });
});
