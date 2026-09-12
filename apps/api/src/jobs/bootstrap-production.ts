import { PERMISSIONS } from "@tracelink/contracts";

import {
  parseProductionBootstrapEnvironment,
  ProductionBootstrapEnvironmentError,
} from "../config/bootstrap-env.js";
import {
  createPostgresDatabase,
  type SqlExecutor,
} from "../database/index.js";
import { ROLE_CATALOG, assertRbacCatalog } from "../modules/roles/rbac-catalog.js";
import { hashPassword } from "../shared/security/password.js";

type IdRow = Readonly<{ id: string }>;

async function insertOrganization(executor: SqlExecutor): Promise<string> {
  const existing = await executor.query<IdRow>(
    "SELECT id FROM organizations WHERE slug = 'ch-market' LIMIT 1 FOR UPDATE",
  );
  if (existing.rows[0] !== undefined) {
    throw new Error(
      "CH Market ya existe. El bootstrap es de un solo uso; administra la organización existente sin repetirlo.",
    );
  }

  const inserted = await executor.query<IdRow>(
    `INSERT INTO organizations
       (name, slug, locale, currency, timezone, active, created_at, updated_at)
     VALUES ('CH Market', 'ch-market', 'es-CL', 'CLP',
             'America/Santiago', true, now(), now())
     RETURNING id`,
  );
  const organizationId = inserted.rows[0]?.id;
  if (organizationId === undefined) throw new Error("Organization insert returned no id.");
  return organizationId;
}

async function insertRbac(executor: SqlExecutor, organizationId: string): Promise<string> {
  for (const permission of PERMISSIONS) {
    await executor.query(
      `INSERT INTO permissions (key, description, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
      [permission, `Permiso TraceLink: ${permission}`],
    );
  }

  let superAdminRoleId: string | undefined;
  for (const role of ROLE_CATALOG) {
    const inserted = await executor.query<IdRow>(
      `INSERT INTO roles
         (organization_id, code, label, description, system, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       RETURNING id`,
      [organizationId, role.code, role.label, role.description, role.system],
    );
    const roleId = inserted.rows[0]?.id;
    if (roleId === undefined) throw new Error(`Role ${role.code} insert returned no id.`);
    if (role.code === "SUPER_ADMIN") superAdminRoleId = roleId;
    for (const permission of role.permissions) {
      await executor.query(
        `INSERT INTO role_permissions
           (organization_id, role_id, permission_key, created_at)
         VALUES ($1, $2, $3, now())`,
        [organizationId, roleId, permission],
      );
    }
  }

  if (superAdminRoleId === undefined) throw new Error("SUPER_ADMIN role is missing.");
  return superAdminRoleId;
}

async function run(): Promise<void> {
  const config = parseProductionBootstrapEnvironment(process.env);
  assertRbacCatalog();
  const passwordHash = await hashPassword(config.BOOTSTRAP_ADMIN_PASSWORD);
  const database = createPostgresDatabase({
    databaseUrl: config.DATABASE_URL,
    max: 2,
  });

  try {
    const organizationId = await database.sqlTransaction(async (executor) => {
      await executor.query("SELECT pg_advisory_xact_lock(hashtext('tracelink.production.bootstrap'))");
      const createdOrganizationId = await insertOrganization(executor);
      await executor.query(
        `INSERT INTO organization_settings
           (organization_id, contact_email, contact_phone, pickup_address,
            pickup_instructions, low_stock_threshold, package_alert_days,
            expiration_warning_days, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
        [
          createdOrganizationId,
          config.BOOTSTRAP_CONTACT_EMAIL,
          config.BOOTSTRAP_CONTACT_PHONE,
          config.BOOTSTRAP_PICKUP_ADDRESS,
          config.BOOTSTRAP_PICKUP_INSTRUCTIONS,
          config.BOOTSTRAP_LOW_STOCK_THRESHOLD,
          config.BOOTSTRAP_PACKAGE_ALERT_DAYS,
          config.BOOTSTRAP_EXPIRATION_WARNING_DAYS,
        ],
      );
      const superAdminRoleId = await insertRbac(executor, createdOrganizationId);
      const user = await executor.query<IdRow>(
        `INSERT INTO users
           (email, email_normalized, first_name, last_name, password_hash,
            status, email_verified_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now(), now(), now())
         RETURNING id`,
        [
          config.BOOTSTRAP_ADMIN_EMAIL,
          config.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
          config.BOOTSTRAP_ADMIN_FIRST_NAME,
          config.BOOTSTRAP_ADMIN_LAST_NAME,
          passwordHash,
        ],
      );
      const userId = user.rows[0]?.id;
      if (userId === undefined) throw new Error("SUPER_ADMIN user insert returned no id.");
      await executor.query(
        `INSERT INTO memberships
           (organization_id, user_id, role_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'ACTIVE', now(), now())`,
        [createdOrganizationId, userId, superAdminRoleId],
      );
      return createdOrganizationId;
    });
    process.stdout.write(
      `Production bootstrap completed for CH Market (${organizationId}). No demo commerce data was created.\n`,
    );
  } finally {
    await database.close();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof ProductionBootstrapEnvironmentError
    ? error.message
    : `Production bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}`;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
