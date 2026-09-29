import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PERMISSIONS, authSessionEnvelopeSchema } from "@tracelink/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createPostgresDatabase, type PostgresDatabase } from "../../src/database/index.js";
import { ROLE_CATALOG } from "../../src/modules/roles/rbac-catalog.js";
import { initializeStaging, StagingInitConflictError } from "../../src/modules/staging/staging-initialization.js";
import { stagingInitEnvironment } from "../support/staging-init-environment.js";
import { createTestConfig } from "../support/test-config.js";

const databaseUrl = process.env["TEST_STAGING_INIT_DATABASE_URL"];
if (databaseUrl === undefined) throw new Error("Isolated staging-init test DB required.");
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.pathname !== "/tracelink_staging_init_test") {
  throw new Error("Refusing to run staging-init tests outside the isolated loopback DB.");
}
let database: PostgresDatabase;
const environment = stagingInitEnvironment(databaseUrl, true);
const minimalTables = ["organizations", "organization_settings", "roles", "permissions",
  "role_permissions", "users", "memberships"] as const;

beforeAll(async () => {
  database = createPostgresDatabase({ databaseUrl });
  const result = await database.query<{ name: string }>("SELECT current_database() AS name");
  if (result.rows[0]?.name !== "tracelink_staging_init_test") throw new Error("Unexpected database.");
});
beforeEach(async () => {
  // Only this dedicated, newly created loopback test database is ever reset.
  await database.query("TRUNCATE organizations, users, permissions, rate_limit_buckets CASCADE");
});
afterAll(async () => { await database.close(); });

async function snapshot(): Promise<string> {
  const digest = createHash("sha256");
  for (const table of minimalTables) {
    const rows = await database.query<{ data: unknown }>(
      `SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY to_jsonb(t)::text`,
    );
    digest.update(JSON.stringify(rows.rows));
  }
  return digest.digest("hex");
}

async function assertMinimalCounts(adminCount: number): Promise<void> {
  const expected = [1, 1, ROLE_CATALOG.length, PERMISSIONS.length,
    ROLE_CATALOG.reduce((sum, role) => sum + role.permissions.length, 0), adminCount, adminCount];
  for (const [index, table] of minimalTables.entries()) {
    const result = await database.query<{ count: number }>(`SELECT count(*)::integer AS count FROM ${table}`);
    expect(result.rows[0]?.count, table).toBe(expected[index]);
  }
  // All commerce, customer, session, audit and operational tables must remain empty.
  const tables = await database.query<{ table: string }>(
    `SELECT tablename AS "table" FROM pg_tables WHERE schemaname = 'public'`,
  );
  for (const { table } of tables.rows) {
    if (minimalTables.some((name) => name === table) || table.startsWith("_prisma")) continue;
    if (!/^[a-z_]+$/.test(table)) throw new Error("Unexpected application table.");
    const result = await database.query<{ count: number }>(`SELECT count(*)::integer AS count FROM "${table}"`);
    expect(result.rows[0]?.count, table).toBe(0);
  }
}

async function runCommand(overrides: NodeJS.ProcessEnv = {}): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/jobs/initialize-staging.ts"], {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: { ...process.env, ...environment, ...overrides },
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { output += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { output += chunk; });
    child.once("error", () => reject(new Error("Could not start staging-init test process.")));
    child.once("exit", (code) => resolve({ code, output }));
  });
}

describe("staging:init against isolated PostgreSQL", () => {
  it("creates only minimal data without credentials and is byte-for-byte idempotent", async () => {
    const noAdmin = stagingInitEnvironment(databaseUrl);
    expect(await initializeStaging(noAdmin)).toEqual({ admin: "omitted" });
    await assertMinimalCounts(0);
    const first = await snapshot();
    expect(await initializeStaging(noAdmin)).toEqual({ admin: "omitted" });
    expect(await snapshot()).toBe(first);
    await assertMinimalCounts(0);
  });

  it("creates an optional admin once, preserves hash/timestamps and supports real staff auth", async () => {
    expect(await initializeStaging(environment)).toEqual({ admin: "created" });
    await assertMinimalCounts(1);
    const first = await snapshot();
    expect(await initializeStaging(environment)).toEqual({ admin: "unchanged" });
    expect(await snapshot()).toBe(first);
    const config = createTestConfig({ databaseUrl, nodeEnv: "production", appEnv: "staging",
      sessionCookieSameSite: "none", trustProxy: 1 });
    const response = await request(createApp({ config, database,
      readinessCheck: () => database.readinessCheck() }))
      .post("/api/v1/auth/login").set("Origin", config.webOrigin).set("X-Forwarded-Proto", "https")
      .send({ audience: "staff", email: environment["STAGING_ADMIN_EMAIL"],
        password: environment["STAGING_ADMIN_PASSWORD"] });
    expect(response.status).toBe(200);
    const envelope = authSessionEnvelopeSchema.parse(response.body);
    expect(envelope.session.audience).toBe("staff");
    const cookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(cookie.includes("HttpOnly")).toBe(true);
    expect(cookie.includes("Secure")).toBe(true);
    expect(cookie.includes("SameSite=None")).toBe(true);
  });

  it("serializes simultaneous runs without duplicates", async () => {
    const results = await Promise.all([initializeStaging(environment), initializeStaging(environment)]);
    expect(results.map((result) => result.admin).sort()).toEqual(["created", "unchanged"]);
    await assertMinimalCounts(1);
  });

  it("fills missing settings and roles without overwriting existing descriptions", async () => {
    await initializeStaging(stagingInitEnvironment(databaseUrl));
    await database.query("DELETE FROM organization_settings");
    await database.query("DELETE FROM roles WHERE code = 'WAREHOUSE'");
    await database.query("UPDATE permissions SET description = 'Owner description' WHERE key = $1", [PERMISSIONS[0]]);
    await initializeStaging(stagingInitEnvironment(databaseUrl));
    await assertMinimalCounts(0);
    const permission = await database.query<{ description: string }>(
      "SELECT description FROM permissions WHERE key = $1", [PERMISSIONS[0]],
    );
    expect(permission.rows[0]?.description).toBe("Owner description");
  });

  it.each([
    ["organization currency", "UPDATE organizations SET currency = 'USD'"],
    ["inactive organization", "UPDATE organizations SET active = false"],
    ["settings", "UPDATE organization_settings SET low_stock_threshold = 9"],
    ["role identity", "UPDATE roles SET system = false WHERE code = 'ADMIN'"],
    ["revoked grant", "DELETE FROM role_permissions WHERE permission_key = 'products.view'"],
    ["inactive user", "UPDATE users SET status = 'INACTIVE'"],
    ["inactive membership", "UPDATE memberships SET status = 'INACTIVE'"],
    ["missing membership", "DELETE FROM memberships"],
  ])("fails closed for incompatible %s without modifying rows", async (_label, sql) => {
    await initializeStaging(environment);
    await database.query(sql);
    const before = await snapshot();
    await expect(initializeStaging(environment)).rejects.toBeInstanceOf(StagingInitConflictError);
    expect(await snapshot()).toBe(before);
  });

  it("does not rotate a password and rolls back missing rows on a late conflict", async () => {
    await initializeStaging(environment);
    await database.query("DELETE FROM organization_settings");
    const before = await snapshot();
    await expect(initializeStaging({ ...environment,
      STAGING_ADMIN_PASSWORD: randomBytes(32).toString("base64url"),
    })).rejects.toBeInstanceOf(StagingInitConflictError);
    expect(await snapshot()).toBe(before);
  });

  it("never promotes an unrelated existing identity", async () => {
    await initializeStaging(environment);
    await database.query("DELETE FROM memberships");
    await database.query("UPDATE organizations SET slug = 'other-market'");
    // Even a matching password must not give an unrelated global identity a new tenant role.
    const before = await snapshot();
    await expect(initializeStaging(environment)).rejects.toBeInstanceOf(StagingInitConflictError);
    expect(await snapshot()).toBe(before);
  });

  it("CLI logs contain neither password nor DATABASE_URL on success, validation, conflict or driver failure", async () => {
    const first = await runCommand();
    const second = await runCommand();
    const invalid = await runCommand({ APP_ENV: "production" });
    const conflict = await runCommand({ STAGING_ADMIN_PASSWORD: randomBytes(32).toString("base64url") });
    const failedUrl = new URL(databaseUrl);
    failedUrl.pathname = "/missing_staging_init_database";
    const failure = await runCommand({ DATABASE_URL: failedUrl.toString() });
    expect([first.code, second.code, invalid.code, conflict.code, failure.code]).toEqual([0, 0, 1, 1, 1]);
    expect(first.output.includes("STAGING_INIT_OK")).toBe(true);
    expect(invalid.output.includes("STAGING_INIT_ENV_INVALID")).toBe(true);
    expect(conflict.output.includes("STAGING_INIT_CONFLICT")).toBe(true);
    expect(failure.output.includes("STAGING_INIT_FAILED")).toBe(true);
    for (const result of [first, second, invalid, conflict, failure]) {
      for (const secret of [environment["STAGING_ADMIN_PASSWORD"], databaseUrl, target.password]) {
        if (secret === undefined) throw new Error("Secret test fixture missing.");
        expect(result.output.includes(secret)).toBe(false);
      }
      expect(result.output.includes("$argon2")).toBe(false);
    }
    await assertMinimalCounts(1);
  });

  it("CLI refuses production/local/providers/missing confirmation/incomplete admin without writing", async () => {
    const before = await snapshot();
    for (const overrides of [
      { APP_ENV: "production" }, { APP_ENV: "local" }, { NODE_ENV: "test" },
      { PAYMENT_PROVIDER: "mercadopago" }, { EMAIL_PROVIDER: "resend" },
      { STAGING_INIT_CONFIRM: undefined }, { STAGING_ADMIN_PASSWORD: undefined },
    ]) {
      const result = await runCommand(overrides);
      expect(result.code).toBe(1);
      expect(result.output.includes("STAGING_INIT_ENV_INVALID")).toBe(true);
      expect(await snapshot()).toBe(before);
    }
  });
});
