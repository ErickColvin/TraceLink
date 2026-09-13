import { randomUUID } from "node:crypto";

import { authSessionEnvelopeSchema } from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createPostgresDatabase, type PostgresDatabase } from "../../src/database/index.js";
import {
  AUTH_IP_MAX_ATTEMPTS,
  PersistentRateLimiter,
  RATE_LIMIT_PRUNE_BATCH_SIZE,
} from "../../src/middleware/rate-limit.js";
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
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", config.webOrigin)
      .send({
        audience: "staff",
        email: "admin@chmarket.test",
        password: "Definitely-Wrong-Password-123!",
      });
    expect(wrongPassword.status).toBe(401);

    const statuses: number[] = [];
    let invalidIdentityBody: unknown;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", config.webOrigin)
        .send({
          audience: "customer",
          email: "missing-rate-limit@example.com",
          password: "Wrong-Password-123!",
        });
      invalidIdentityBody ??= response.body;
      statuses.push(response.status);
    }
    expect(wrongPassword.body.error).toEqual(
      typeof invalidIdentityBody === "object" && invalidIdentityBody !== null
        ? Reflect.get(invalidIdentityBody, "error")
        : undefined,
    );
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
    await database.query(
      `DELETE FROM rate_limit_buckets
        WHERE scope IN ('auth.ip', 'auth.login.account')`,
    );
  });

  it("keeps one global budget across login, rotated emails, and equivalent IP spellings", async () => {
    const trustedProxyConfig = createTestConfig({
      databaseUrl,
      trustProxy: 1,
    });
    const app = createApp({
      config: trustedProxyConfig,
      database,
      readinessCheck: () => database.readinessCheck(),
    });
    const equivalentForwardedIps = [
      "2001:db8::247",
      "2001:0db8:0:0:0:0:0:247",
    ] as const;
    const success = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", trustedProxyConfig.webOrigin)
      .set("X-Forwarded-For", equivalentForwardedIps[0])
      .send({
        audience: "staff",
        email: "admin@chmarket.test",
        password: "Admin-Test-Password-123!",
      });
    expect(success.status).toBe(200);

    const statuses: number[] = [];
    for (let attempt = 0; attempt < AUTH_IP_MAX_ATTEMPTS; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .set("Origin", trustedProxyConfig.webOrigin)
        .set(
          "X-Forwarded-For",
          equivalentForwardedIps[attempt % equivalentForwardedIps.length]!,
        )
        .send({
          audience: "customer",
          email: `rotated-${attempt}-${randomUUID()}@example.com`,
          password: "Wrong-Password-123!",
        });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, -1)).toEqual(
      Array.from({ length: AUTH_IP_MAX_ATTEMPTS - 1 }, () => 401),
    );
    expect(statuses.at(-1)).toBe(429);
    await database.query(
      `DELETE FROM rate_limit_buckets
        WHERE scope IN ('auth.ip', 'auth.login.account')`,
    );
  });

  it("opportunistically prunes expired rate-limit buckets in bounded batches", async () => {
    const scope = `test.prune.${randomUUID()}`;
    await database.query(`DELETE FROM rate_limit_buckets WHERE expires_at <= now()`);
    await database.query(
      `INSERT INTO rate_limit_buckets
         (scope, key_hash, window_started_at, count, blocked_until,
          expires_at, updated_at)
       SELECT $1,
              decode(lpad(to_hex(value), 64, '0'), 'hex'),
              now() - interval '2 hours', 1, NULL,
              now() - interval '1 hour', now()
         FROM generate_series(1, $2) AS value`,
      [scope, RATE_LIMIT_PRUNE_BATCH_SIZE + 2],
    );

    const limiter = new PersistentRateLimiter(database, config.rateLimitSecret);
    await limiter.consume({
      scope: `${scope}.trigger`,
      key: "trigger",
      maxAttempts: 1,
      windowSeconds: 60,
      blockSeconds: 60,
    });

    const remaining = await database.query<Readonly<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM rate_limit_buckets
        WHERE scope = $1 AND expires_at <= now()`,
      [scope],
    );
    expect(remaining.rows[0]?.count).toBe(2);
    await database.query(`DELETE FROM rate_limit_buckets WHERE scope = $1`, [scope]);
  });
});
