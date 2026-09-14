import { randomUUID } from "node:crypto";

import { authSessionEnvelopeSchema } from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import {
  createPostgresDatabase,
  type PostgresDatabase,
} from "../../src/database/index.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
if (databaseUrl === undefined) {
  throw new Error("TEST_DATABASE_URL is required for integration tests.");
}

const config = createTestConfig({ databaseUrl, sessionIdleTtlSeconds: 1 });
const unique = randomUUID().slice(0, 8);
let database: PostgresDatabase;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  await database.connect();
  app = createApp({
    config,
    database,
    readinessCheck: () => database.readinessCheck(),
  });
});

afterAll(async () => {
  await database.close();
});

async function registerCustomer(
  agent: ReturnType<typeof request.agent>,
  email: string,
) {
  const response = await agent
    .post("/api/v1/auth/register")
    .set("Origin", config.webOrigin)
    .send({
      firstName: "Security",
      lastName: "Integration",
      email,
      password: "Customer-Security-Password-123!",
      phone: "+56912345678",
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return authSessionEnvelopeSchema.parse(response.body);
}

describe("security boundaries against PostgreSQL", () => {
  it("rejects a tampered CSRF token without revoking the valid session", async () => {
    const agent = request.agent(app);
    const envelope = await registerCustomer(
      agent,
      `csrf-security-${unique}@example.com`,
    );

    const invalid = await agent
      .post("/api/v1/auth/logout")
      .set("Origin", config.webOrigin)
      .set("X-CSRF-Token", `${envelope.csrfToken}tampered`);

    expect(invalid.status).toBe(403);
    expect(invalid.body.error.code).toBe("CSRF_INVALID");
    expect(await agent.get("/api/v1/auth/me")).toHaveProperty("status", 200);
  });

  it("revokes an idle-expired session and clears its cookie", async () => {
    const agent = request.agent(app);
    const envelope = await registerCustomer(
      agent,
      `expired-security-${unique}@example.com`,
    );
    const session = envelope.session;

    await database.query(
      `UPDATE sessions
          SET last_seen_at = now() - interval '5 seconds'
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [session.user.id],
    );

    const expired = await agent.get("/api/v1/auth/me");
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("SESSION_EXPIRED");
    expect(expired.headers["set-cookie"]?.[0]).toContain("Max-Age=0");

    const persisted = await database.query<
      Readonly<{ revoked: number; reason: string | null }>
    >(
      `SELECT COUNT(*)::integer AS revoked,
              MAX(revocation_reason) AS reason
         FROM sessions
        WHERE user_id = $1 AND revoked_at IS NOT NULL`,
      [session.user.id],
    );
    expect(persisted.rows[0]).toEqual({ revoked: 1, reason: "idle_timeout" });
  });

  it("rejects an active session and a new login after the user is disabled", async () => {
    const agent = request.agent(app);
    const email = `disabled-security-${unique}@example.com`;
    const envelope = await registerCustomer(agent, email);

    await database.query(
      `UPDATE users SET status = 'INACTIVE', updated_at = now() WHERE id = $1`,
      [envelope.session.user.id],
    );

    const currentSession = await agent.get("/api/v1/auth/me");
    expect(currentSession.status).toBe(401);
    expect(currentSession.body.error.code).toBe("UNAUTHENTICATED");
    expect(currentSession.headers["set-cookie"]?.[0]).toContain("Max-Age=0");

    const login = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", config.webOrigin)
      .send({
        audience: "customer",
        email,
        password: "Customer-Security-Password-123!",
      });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe("ACCOUNT_DISABLED");
    expect(login.headers["set-cookie"]).toBeUndefined();
  });
});
