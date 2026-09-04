import { randomUUID } from "node:crypto";

import {
  authSessionEnvelopeSchema,
  packageCustomerOptionPageSchema,
  packagePageSchema,
  staffPackageSchema,
} from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import {
  createPostgresDatabase,
  type PostgresDatabase,
} from "../../src/database/index.js";
import { hashPickupCode } from "../../src/modules/packages/pickup-code.js";
import { hashPassword } from "../../src/shared/security/password.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) throw new Error("TEST_DATABASE_URL is required.");

const config = createTestConfig({ databaseUrl });
const unique = randomUUID().slice(0, 8);
const knownPickupCode = `pickup-${unique}`;
let database: PostgresDatabase;
let app: ReturnType<typeof createApp>;
let staffAgent: ReturnType<typeof request.agent>;
let customerAgent: ReturnType<typeof request.agent>;
let otherCustomerAgent: ReturnType<typeof request.agent>;
let restrictedStaffAgent: ReturnType<typeof request.agent>;
let staffCsrf = "";
let customerId = "";
let organizationId = "";
let locationId = "";
let packageId = "";
let foreignPackageId = "";

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  app = createApp({
    config,
    database,
    readinessCheck: () => database.readinessCheck(),
  });
  staffAgent = request.agent(app);
  customerAgent = request.agent(app);
  otherCustomerAgent = request.agent(app);
  restrictedStaffAgent = request.agent(app);

  const organization = await database.query<Readonly<{ id: string }>>(
    "SELECT id FROM organizations WHERE slug = 'ch-market'",
  );
  organizationId = organization.rows[0]?.id ?? "";
  const location = await database.query<Readonly<{ id: string }>>(
    `INSERT INTO inventory_locations
       (organization_id, name, code, active, updated_at)
     VALUES ($1, $2, $3, true, now()) RETURNING id`,
    [organizationId, `Recepción ${unique}`, `PKG-${unique}`],
  );
  locationId = location.rows[0]?.id ?? "";

  const staffLogin = await staffAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: "admin@chmarket.test",
      password: "Admin-Test-Password-123!",
    });
  staffCsrf = authSessionEnvelopeSchema.parse(staffLogin.body).csrfToken;

  const registration = await customerAgent
    .post("/api/v1/auth/register")
    .set("Origin", config.webOrigin)
    .send({
      firstName: "Cliente",
      lastName: "Paquetes",
      email: `packages-${unique}@example.com`,
      password: "Customer-Test-Password-123!",
      phone: "+56944445555",
    });
  const customerSession = authSessionEnvelopeSchema.parse(registration.body);
  customerId = customerSession.session.audience === "customer"
    ? customerSession.session.customer.id
    : "";

  await otherCustomerAgent
    .post("/api/v1/auth/register")
    .set("Origin", config.webOrigin)
    .send({
      firstName: "Otra",
      lastName: "Persona",
      email: `packages-other-${unique}@example.com`,
      password: "Customer-Test-Password-123!",
    })
    .expect(201);

  const restrictedPassword = "Restricted-Test-Password-123!";
  const restrictedHash = await hashPassword(restrictedPassword);
  await database.sqlTransaction(async (executor) => {
    const role = await executor.query<Readonly<{ id: string }>>(
      `SELECT id FROM roles WHERE organization_id = $1 AND code = 'INVENTORY'`,
      [organizationId],
    );
    const user = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO users
         (email, email_normalized, first_name, last_name, password_hash,
          status, updated_at)
       VALUES ($1, $1, 'Personal', 'Restringido', $2, 'ACTIVE', now())
       RETURNING id`,
      [`restricted-${unique}@example.com`, restrictedHash],
    );
    await executor.query(
      `INSERT INTO memberships
         (organization_id, user_id, role_id, status, updated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now())`,
      [organizationId, user.rows[0]?.id, role.rows[0]?.id],
    );
  });
  await restrictedStaffAgent
    .post("/api/v1/auth/login")
    .set("Origin", config.webOrigin)
    .send({
      audience: "staff",
      email: `restricted-${unique}@example.com`,
      password: restrictedPassword,
    })
    .expect(200);

  foreignPackageId = await database.sqlTransaction(async (executor) => {
    const organization = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO organizations
         (name, slug, locale, currency, timezone, active, updated_at)
       VALUES ('Tenant paquetes', $1, 'es-CL', 'CLP', 'America/Santiago', true, now())
       RETURNING id`,
      [`package-tenant-${unique}`],
    );
    const otherOrganizationId = organization.rows[0]?.id ?? "";
    const customer = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO customers
         (organization_id, first_name, last_name, email, email_normalized,
          status, updated_at)
       VALUES ($1, 'Cliente', 'Ajeno', $2, $2, 'ACTIVE', now()) RETURNING id`,
      [otherOrganizationId, `foreign-${unique}@example.com`],
    );
    const parcel = await executor.query<Readonly<{ id: string }>>(
      `INSERT INTO packages
         (organization_id, customer_id, tracking_code, carrier, description,
          item_count, requires_cold_storage, status, updated_at)
       VALUES ($1, $2, $3, 'CH Market', 'Ajeno', 1, false, 'RECEIVED', now())
       RETURNING id`,
      [otherOrganizationId, customer.rows[0]?.id, `FOREIGN-${unique}`],
    );
    return parcel.rows[0]?.id ?? "";
  });
});

afterAll(async () => {
  await database.close();
});

describe("package API against PostgreSQL", () => {
  it("enforces permission, CSRF, strict input, tenant scope and customer options", async () => {
    const denied = await restrictedStaffAgent.get("/api/v1/staff/packages");
    expect(denied.status).toBe(403);

    const foreign = await staffAgent.get(`/api/v1/staff/packages/${foreignPackageId}`);
    expect(foreign.status).toBe(404);

    const options = await staffAgent.get(
      `/api/v1/staff/package-customer-options?search=packages-${unique}`,
    );
    expect(options.status).toBe(200);
    expect(
      packageCustomerOptionPageSchema.parse(options.body).items
        .some((customer) => customer.id === customerId),
    ).toBe(true);

    const missingCsrf = await staffAgent
      .post("/api/v1/staff/packages")
      .set("Origin", config.webOrigin)
      .set("Idempotency-Key", `missing-csrf-${unique}`)
      .send({});
    expect(missingCsrf.status).toBe(403);

    const strictInput = await staffAgent
      .post("/api/v1/staff/packages")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `strict-${unique}`)
      .send({
        trackingCode: `STRICT-${unique}`,
        carrier: "CH Market",
        customerId,
        contents: {
          description: "Prueba",
          itemCount: 1,
          requiresColdStorage: false,
        },
        storageLocation: `PKG-${unique}`,
        actor: { id: randomUUID(), name: "No autorizado" },
      });
    expect(strictInput.status).toBe(400);
  });

  it("receives exactly once, stores only a pickup hash and audits the mutation", async () => {
    const payload = {
      trackingCode: `chm-${unique}`,
      carrier: "Blue Express",
      customerId,
      contents: {
        description: "Productos refrigerados",
        itemCount: 2,
        requiresColdStorage: true,
      },
      storageLocation: `PKG-${unique}`,
      notes: "Manipular con cuidado",
      receivedAt: new Date().toISOString(),
      weightKg: 2.5,
    };
    const missingKey = await staffAgent
      .post("/api/v1/staff/packages")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .send(payload);
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const key = `receive-${unique}`;
    const createdResponse = await staffAgent
      .post("/api/v1/staff/packages")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", key)
      .send(payload);
    expect(createdResponse.status, JSON.stringify(createdResponse.body)).toBe(201);
    const created = staffPackageSchema.parse(createdResponse.body);
    packageId = created.id;
    expect(created.status).toBe("RECEIVED");
    expect(created.trackingCode).toBe(`CHM-${unique.toUpperCase()}`);
    expect(created.storageLocation).toBe(`Recepción ${unique}`);
    expect(created.events).toHaveLength(1);
    expect(JSON.stringify(createdResponse.body)).not.toContain(knownPickupCode);

    const credential = await database.query<Readonly<{
      pickupCodeHash: Buffer | null;
      pickupCodeConsumedAt: Date | null;
    }>>(
      `SELECT pickup_code_hash AS "pickupCodeHash",
              pickup_code_consumed_at AS "pickupCodeConsumedAt"
         FROM packages WHERE organization_id = $1 AND id = $2`,
      [organizationId, packageId],
    );
    expect(credential.rows[0]?.pickupCodeHash).toHaveLength(32);
    expect(credential.rows[0]?.pickupCodeConsumedAt).toBeNull();

    const replay = await staffAgent
      .post("/api/v1/staff/packages")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", key)
      .send(payload);
    expect(replay.status).toBe(201);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(staffPackageSchema.parse(replay.body).id).toBe(packageId);

    const conflict = await staffAgent
      .post("/api/v1/staff/packages")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", key)
      .send({ ...payload, carrier: "Starken" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");

    const count = await database.query<Readonly<{ total: number }>>(
      `SELECT COUNT(*)::integer AS total FROM packages
        WHERE organization_id = $1 AND tracking_code = $2`,
      [organizationId, `CHM-${unique.toUpperCase()}`],
    );
    expect(count.rows[0]?.total).toBe(1);
  });

  it("protects customer ownership and persists the tracking state machine", async () => {
    const pageResponse = await customerAgent.get("/api/v1/me/packages");
    expect(pageResponse.status).toBe(200);
    expect(
      packagePageSchema.parse(pageResponse.body).items
        .some((parcel) => parcel.id === packageId),
    ).toBe(true);

    const outsideOwnership = await otherCustomerAgent.get(
      `/api/v1/me/packages/${packageId}`,
    );
    expect(outsideOwnership.status).toBe(404);

    const skipped = await staffAgent
      .post(`/api/v1/staff/packages/${packageId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `skip-${unique}`)
      .send({ toStatus: "READY_FOR_PICKUP" });
    expect(skipped.status).toBe(409);
    expect(skipped.body.error.code).toBe("INVALID_STATE_TRANSITION");

    const stored = await staffAgent
      .post(`/api/v1/staff/packages/${packageId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `stored-${unique}`)
      .send({ toStatus: "STORED", location: `PKG-${unique}` });
    expect(stored.status).toBe(200);
    expect(staffPackageSchema.parse(stored.body).status).toBe("STORED");

    const ready = await staffAgent
      .post(`/api/v1/staff/packages/${packageId}/transitions`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `ready-${unique}`)
      .send({ toStatus: "READY_FOR_PICKUP" });
    expect(ready.status).toBe(200);
    const readyPackage = staffPackageSchema.parse(ready.body);
    expect(readyPackage.status).toBe("READY_FOR_PICKUP");
    expect(readyPackage.events.map((event) => event.newStatus)).toEqual([
      "RECEIVED",
      "STORED",
      "READY_FOR_PICKUP",
    ]);
  });

  it("delivers only with a valid unexpired code and consumes it atomically", async () => {
    const invalid = await staffAgent
      .post(`/api/v1/staff/packages/${packageId}/delivery`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", `invalid-delivery-${unique}`)
      .send({ pickupCode: "incorrecto", receivedBy: "Cliente Paquetes" });
    expect(invalid.status).toBe(409);

    const knownHash = hashPickupCode(
      config.pickupCodeSecret,
      organizationId,
      packageId,
      knownPickupCode,
    );
    await database.query(
      `UPDATE packages
          SET pickup_code_hash = $3, pickup_code_consumed_at = NULL,
              pickup_deadline = now() + interval '1 hour'
        WHERE organization_id = $1 AND id = $2`,
      [organizationId, packageId, knownHash],
    );

    const key = `delivery-${unique}`;
    const deliveredResponse = await staffAgent
      .post(`/api/v1/staff/packages/${packageId}/delivery`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", key)
      .send({ pickupCode: knownPickupCode, receivedBy: "Cliente Paquetes" });
    expect(deliveredResponse.status, JSON.stringify(deliveredResponse.body)).toBe(200);
    const delivered = staffPackageSchema.parse(deliveredResponse.body);
    expect(delivered.status).toBe("PICKED_UP");
    expect(delivered.pickupReceipt).toMatchObject({
      receivedBy: "Cliente Paquetes",
      pickupCodeVerified: true,
    });
    expect(JSON.stringify(deliveredResponse.body)).not.toContain(knownPickupCode);

    const replay = await staffAgent
      .post(`/api/v1/staff/packages/${packageId}/delivery`)
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", staffCsrf)
      .set("Idempotency-Key", key)
      .send({ pickupCode: knownPickupCode, receivedBy: "Cliente Paquetes" });
    expect(replay.status).toBe(200);
    expect(replay.headers["idempotency-replayed"]).toBe("true");

    const persisted = await database.query<Readonly<{
      status: string;
      pickupCodeHash: Buffer | null;
      pickupCodeConsumedAt: Date | null;
      receiptCount: number;
      eventCount: number;
      auditCount: number;
    }>>(
      `SELECT p.status,
              p.pickup_code_hash AS "pickupCodeHash",
              p.pickup_code_consumed_at AS "pickupCodeConsumedAt",
              (SELECT COUNT(*)::integer FROM package_pickup_receipts r
                WHERE r.organization_id = p.organization_id AND r.package_id = p.id)
                AS "receiptCount",
              (SELECT COUNT(*)::integer FROM tracking_events event
                WHERE event.organization_id = p.organization_id AND event.package_id = p.id)
                AS "eventCount",
              (SELECT COUNT(*)::integer FROM audit_logs audit
                WHERE audit.organization_id = p.organization_id
                  AND audit.entity_type = 'Package' AND audit.entity_id = p.id)
                AS "auditCount"
         FROM packages p WHERE p.organization_id = $1 AND p.id = $2`,
      [organizationId, packageId],
    );
    expect(persisted.rows[0]).toMatchObject({
      status: "PICKED_UP",
      pickupCodeHash: null,
      receiptCount: 1,
      eventCount: 4,
      auditCount: 4,
    });
    expect(persisted.rows[0]?.pickupCodeConsumedAt).toBeInstanceOf(Date);

    const leaked = await database.query<Readonly<{ leaked: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM audit_logs
          WHERE organization_id = $1 AND entity_type = 'Package'
            AND (COALESCE(before_json::text, '') LIKE $2
              OR COALESCE(after_json::text, '') LIKE $2)
       ) AS leaked`,
      [organizationId, `%${knownPickupCode}%`],
    );
    expect(leaked.rows[0]?.leaked).toBe(false);
    expect(locationId).not.toBe("");
  });
});
