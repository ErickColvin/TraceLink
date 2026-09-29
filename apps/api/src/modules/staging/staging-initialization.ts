import { PERMISSIONS } from "@tracelink/contracts";

import {
  parseStagingInitEnvironment,
  type StagingInitConfig,
} from "../../config/staging-init-env.js";
import { createPostgresDatabase, type SqlExecutor } from "../../database/index.js";
import { hashPassword, verifyPassword } from "../../shared/security/password.js";
import { assertRbacCatalog, ROLE_CATALOG } from "../roles/rbac-catalog.js";

type IdRow = Readonly<{ id: string }>;
type ConflictArea = "organization" | "settings" | "roles" | "admin";

export class StagingInitConflictError extends Error {
  constructor(readonly area: ConflictArea) {
    super(`STAGING_INIT_CONFLICT: ${area}. No existing data was changed.`);
    this.name = "StagingInitConflictError";
  }
}

async function ensureOrganization(executor: SqlExecutor): Promise<string> {
  const result = await executor.query<IdRow & Readonly<{
    name: string; locale: string; currency: string; timezone: string; active: boolean;
  }>>(
    `SELECT id, name, locale, currency, timezone, active
       FROM organizations WHERE slug = 'ch-market' FOR UPDATE`,
  );
  const existing = result.rows[0];
  if (existing !== undefined) {
    if (existing.name !== "CH Market" || existing.locale !== "es-CL" ||
        existing.currency !== "CLP" || existing.timezone !== "America/Santiago" ||
        !existing.active) {
      throw new StagingInitConflictError("organization");
    }
    return existing.id;
  }
  const inserted = await executor.query<IdRow>(
    `INSERT INTO organizations
       (name, slug, locale, currency, timezone, active, created_at, updated_at)
     VALUES ('CH Market', 'ch-market', 'es-CL', 'CLP', 'America/Santiago', true, now(), now())
     RETURNING id`,
  );
  const id = inserted.rows[0]?.id;
  if (id === undefined) throw new Error("Organization insert returned no id.");
  return id;
}

async function ensureSettings(
  executor: SqlExecutor, organizationId: string, config: StagingInitConfig,
): Promise<void> {
  const expected = {
    contactEmail: config.STAGING_CONTACT_EMAIL,
    contactPhone: config.STAGING_CONTACT_PHONE,
    pickupAddress: config.STAGING_PICKUP_ADDRESS,
    pickupInstructions: config.STAGING_PICKUP_INSTRUCTIONS,
    lowStockThreshold: 5,
    packageAlertDays: 5,
    expirationWarningDays: 30,
  };
  const result = await executor.query<typeof expected>(
    `SELECT contact_email AS "contactEmail", contact_phone AS "contactPhone",
            pickup_address AS "pickupAddress", pickup_instructions AS "pickupInstructions",
            low_stock_threshold AS "lowStockThreshold", package_alert_days AS "packageAlertDays",
            expiration_warning_days AS "expirationWarningDays"
       FROM organization_settings WHERE organization_id = $1 FOR UPDATE`,
    [organizationId],
  );
  const existing = result.rows[0];
  if (existing !== undefined) {
    if (Object.entries(expected).some(([key, value]) => Reflect.get(existing, key) !== value)) {
      throw new StagingInitConflictError("settings");
    }
    return;
  }
  await executor.query(
    `INSERT INTO organization_settings
       (organization_id, contact_email, contact_phone, pickup_address, pickup_instructions,
        low_stock_threshold, package_alert_days, expiration_warning_days, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 5, 5, 30, now(), now())`,
    [organizationId, expected.contactEmail, expected.contactPhone,
      expected.pickupAddress, expected.pickupInstructions],
  );
}

async function ensureRbac(executor: SqlExecutor, organizationId: string): Promise<string> {
  for (const permission of PERMISSIONS) {
    await executor.query(
      `INSERT INTO permissions (key, description, created_at)
       VALUES ($1, $2, now()) ON CONFLICT (key) DO NOTHING`,
      [permission, `Permiso TraceLink: ${permission}`],
    );
  }
  const existingRoles = await executor.query<IdRow & Readonly<{
    code: string; system: boolean;
  }>>(
    "SELECT id, code, system FROM roles WHERE organization_id = $1 FOR UPDATE",
    [organizationId],
  );
  if (existingRoles.rows.some((row) => !row.system ||
      !ROLE_CATALOG.some((role) => role.code === row.code))) {
    throw new StagingInitConflictError("roles");
  }
  let adminRoleId: string | undefined;
  for (const role of ROLE_CATALOG) {
    const existing = existingRoles.rows.find((row) => row.code === role.code);
    let roleId = existing?.id;
    if (existing !== undefined) {
      const grants = await executor.query<Readonly<{ key: string }>>(
        `SELECT permission_key AS key FROM role_permissions
          WHERE organization_id = $1 AND role_id = $2 FOR UPDATE`,
        [organizationId, existing.id],
      );
      // A modified role is not a partially seeded role. Never silently regrant privileges.
      const expected = new Set<string>(role.permissions);
      if (grants.rows.length !== expected.size || grants.rows.some((row) => !expected.has(row.key))) {
        throw new StagingInitConflictError("roles");
      }
    } else {
      const inserted = await executor.query<IdRow>(
        `INSERT INTO roles
           (organization_id, code, label, description, system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, now(), now()) RETURNING id`,
        [organizationId, role.code, role.label, role.description],
      );
      roleId = inserted.rows[0]?.id;
      if (roleId === undefined) throw new Error("Role insert returned no id.");
      for (const permission of role.permissions) {
        await executor.query(
          `INSERT INTO role_permissions (organization_id, role_id, permission_key, created_at)
           VALUES ($1, $2, $3, now())`,
          [organizationId, roleId, permission],
        );
      }
    }
    if (role.code === "ADMIN") adminRoleId = roleId;
  }
  if (adminRoleId === undefined) throw new Error("ADMIN role is missing.");
  return adminRoleId;
}

async function ensureAdmin(
  executor: SqlExecutor, organizationId: string, roleId: string, config: StagingInitConfig,
): Promise<"omitted" | "created" | "unchanged"> {
  const email = config.STAGING_ADMIN_EMAIL;
  const password = config.STAGING_ADMIN_PASSWORD;
  if (email === undefined || password === undefined) return "omitted";
  const result = await executor.query<IdRow & Readonly<{
    passwordHash: string; status: string;
  }>>(
    `SELECT id, password_hash AS "passwordHash", status
       FROM users WHERE email_normalized = $1 FOR UPDATE`,
    [email],
  );
  const existing = result.rows[0];
  if (existing !== undefined) {
    const memberships = await executor.query<Readonly<{
      organizationId: string; roleId: string; status: string;
    }>>(
      `SELECT organization_id AS "organizationId", role_id AS "roleId", status
         FROM memberships WHERE user_id = $1 FOR UPDATE`,
      [existing.id],
    );
    const customer = await executor.query<IdRow>(
      "SELECT id FROM customers WHERE user_id = $1 LIMIT 1", [existing.id],
    );
    const membership = memberships.rows[0];
    if (existing.status !== "ACTIVE" || memberships.rows.length !== 1 ||
        membership?.organizationId !== organizationId || membership.roleId !== roleId ||
        membership.status !== "ACTIVE" || customer.rows.length !== 0 ||
        !await verifyPassword(existing.passwordHash, password)) {
      // Never adopt an unrelated identity, promote it, reactivate it or rotate its password.
      throw new StagingInitConflictError("admin");
    }
    return "unchanged";
  }
  const inserted = await executor.query<IdRow>(
    `INSERT INTO users
       (email, email_normalized, first_name, last_name, password_hash, status, created_at, updated_at)
     VALUES ($1, $1, 'Staging', 'Administrator', $2, 'ACTIVE', now(), now()) RETURNING id`,
    [email, await hashPassword(password)],
  );
  const userId = inserted.rows[0]?.id;
  if (userId === undefined) throw new Error("Admin insert returned no id.");
  await executor.query(
    `INSERT INTO memberships (organization_id, user_id, role_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'ACTIVE', now(), now())`, [organizationId, userId, roleId],
  );
  return "created";
}

/** Explicit one-off operation. No server, cron, seed or migration calls this function. */
export async function initializeStaging(
  environment: Readonly<Record<string, string | undefined>>,
): Promise<Readonly<{ admin: "omitted" | "created" | "unchanged" }>> {
  // Gate even direct callers, before constructing a pool or making any DB connection.
  const config = parseStagingInitEnvironment(environment);
  assertRbacCatalog();
  const database = createPostgresDatabase({
    databaseUrl: config.DATABASE_URL, max: 2, connectionTimeoutMillis: 10_000,
  });
  try {
    return await database.sqlTransaction(async (executor) => {
      await executor.query("SET LOCAL lock_timeout = '10s'");
      await executor.query("SET LOCAL statement_timeout = '60s'");
      await executor.query("SELECT pg_advisory_xact_lock(hashtext('tracelink.staging.init'))");
      const organizationId = await ensureOrganization(executor);
      await ensureSettings(executor, organizationId, config);
      const adminRoleId = await ensureRbac(executor, organizationId);
      return { admin: await ensureAdmin(executor, organizationId, adminRoleId, config) };
    });
  } finally {
    await database.close();
  }
}
