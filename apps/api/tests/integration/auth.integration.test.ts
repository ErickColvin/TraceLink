import { randomUUID } from "node:crypto";

import { authSessionEnvelopeSchema } from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createPostgresDatabase, type PostgresDatabase } from "../../src/database/index.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required for integration tests.");
}

const config = createTestConfig({ databaseUrl });
let database: PostgresDatabase;
let staffAgent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  staffAgent = request.agent(
    createApp({
      config,
      database,
      readinessCheck: () => database.readinessCheck(),
    }),
  );
});

afterAll(async () => {
  await database.close();
});

describe("authentication against PostgreSQL", () => {
  it("logs staff in, restores /me, enforces CSRF, and revokes logout", async () => {
    const login = await staffAgent
      .post("/api/v1/auth/login")
      .set("Origin", config.webOrigin)
      .send({
        audience: "staff",
        email: "admin@chmarket.test",
        password: "Admin-Test-Password-123!",
      });

    expect(login.status).toBe(200);
    const setCookie = login.headers["set-cookie"]?.[0];
    expect(setCookie).toContain("HttpOnly");
    const envelope = authSessionEnvelopeSchema.parse(login.body);
    expect(envelope.session.audience).toBe("staff");
    const opaqueToken = /tl_session_dev=([^;]+)/.exec(setCookie ?? "")?.[1];
    expect(opaqueToken).toMatch(/^v1\./);
    expect(JSON.stringify(login.body)).not.toContain(opaqueToken);

    const me = await staffAgent.get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(authSessionEnvelopeSchema.parse(me.body).session.user.email).toBe(
      "admin@chmarket.test",
    );

    const missingCsrf = await staffAgent
      .post("/api/v1/auth/logout")
      .set("Origin", config.webOrigin);
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_INVALID");

    const logout = await staffAgent
      .post("/api/v1/auth/logout")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", envelope.csrfToken);
    expect(logout.status).toBe(204);
    expect(logout.headers["set-cookie"]?.[0]).toContain("Max-Age=0");

    const revoked = await staffAgent.get("/api/v1/auth/me");
    expect(revoked.status).toBe(401);
  });

  it("registers customer identities only and creates a persistent profile", async () => {
    const customerAgent = request.agent(
      createApp({ config, database, readinessCheck: () => database.readinessCheck() }),
    );
    const email = `customer-${randomUUID()}@example.com`;
    const registration = await customerAgent
      .post("/api/v1/auth/register")
      .set("Origin", config.webOrigin)
      .send({
        firstName: "Cliente",
        lastName: "Integración",
        email,
        password: "Customer-Test-Password-123!",
        phone: "+56912345678",
      });

    expect(registration.status).toBe(201);
    const envelope = authSessionEnvelopeSchema.parse(registration.body);
    expect(envelope.session.audience).toBe("customer");
    expect(envelope.session.permissions).toEqual([]);

    const stored = await database.query(
      `SELECT c.id, c.email, u.password_hash AS "passwordHash"
       FROM customers c JOIN users u ON u.id = c.user_id
       WHERE c.organization_id = $1 AND c.email_normalized = $2`,
      [envelope.session.organization.id, email.toLowerCase()],
    );
    expect(stored.rowCount).toBe(1);
    expect(stored.rows[0]?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.rows[0]?.passwordHash).not.toContain("Customer-Test-Password");
  });

  it("normalizes invalid credentials and persistently rate limits abuse", async () => {
    const app = createApp({
      config,
      database,
      readinessCheck: () => database.readinessCheck(),
    });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", config.webOrigin)
        .send({
          audience: "customer",
          email: "missing-rate-limit@example.com",
          password: "Wrong-Password-123!",
        });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});
