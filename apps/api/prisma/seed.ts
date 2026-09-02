import "temporal-polyfill/full/global";

import { PERMISSIONS } from "@tracelink/contracts";
import { z } from "zod";

import { createPostgresDatabase, type SqlExecutor } from "../src/database/index.js";
import { ROLE_CATALOG, assertRbacCatalog } from "../src/modules/roles/rbac-catalog.js";
import { hashPassword } from "../src/shared/security/password.js";

const seedEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  }),
  SEED_ADMIN_EMAIL: z.string().trim().email(),
  SEED_ADMIN_PASSWORD: z.string().min(12).max(128),
});

type IdRow = Readonly<{ id: string }>;

async function seedOrganization(transaction: SqlExecutor): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO organizations
       (name, slug, locale, currency, timezone, active, created_at, updated_at)
     VALUES ($1, $2, 'es-CL', 'CLP', 'America/Santiago', true, now(), now())
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       locale = EXCLUDED.locale,
       currency = EXCLUDED.currency,
       timezone = EXCLUDED.timezone,
       active = true,
       updated_at = now()
     RETURNING id`,
    ["CH Market", "ch-market"],
  );
  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error("Organization seed did not return an id.");
  return id;
}

async function seedPermissions(transaction: SqlExecutor): Promise<void> {
  for (const permission of PERMISSIONS) {
    await transaction.query(
      `INSERT INTO permissions (key, description, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
      [permission, `Permiso TraceLink: ${permission}`],
    );
  }
}

async function seedRoles(
  transaction: SqlExecutor,
  organizationId: string,
): Promise<ReadonlyMap<string, string>> {
  const ids = new Map<string, string>();
  for (const role of ROLE_CATALOG) {
    const result = await transaction.query<IdRow>(
      `INSERT INTO roles
         (organization_id, code, label, description, system, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (organization_id, code) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         system = EXCLUDED.system,
         updated_at = now()
       RETURNING id`,
      [organizationId, role.code, role.label, role.description, role.system],
    );
    const roleId = result.rows[0]?.id;
    if (roleId === undefined) throw new Error(`Role ${role.code} did not return an id.`);
    ids.set(role.code, roleId);

    await transaction.query(
      `DELETE FROM role_permissions
       WHERE organization_id = $1 AND role_id = $2`,
      [organizationId, roleId],
    );
    for (const permission of role.permissions) {
      await transaction.query(
        `INSERT INTO role_permissions
           (organization_id, role_id, permission_key, created_at)
         VALUES ($1, $2, $3, now())`,
        [organizationId, roleId, permission],
      );
    }
  }
  return ids;
}

async function seedAdmin(
  transaction: SqlExecutor,
  options: Readonly<{
    organizationId: string;
    roleId: string;
    email: string;
    passwordHash: string;
  }>,
): Promise<void> {
  const emailNormalized = options.email.trim().toLowerCase();
  const userResult = await transaction.query<IdRow>(
    `INSERT INTO users
       (email, email_normalized, first_name, last_name, password_hash, status,
        created_at, updated_at)
     VALUES ($1, $2, 'Administrador', 'CH Market', $3, 'ACTIVE', now(), now())
     ON CONFLICT (email_normalized) DO UPDATE SET
       email = EXCLUDED.email,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       password_hash = EXCLUDED.password_hash,
       status = 'ACTIVE',
       updated_at = now()
     RETURNING id`,
    [options.email.trim(), emailNormalized, options.passwordHash],
  );
  const userId = userResult.rows[0]?.id;
  if (userId === undefined) throw new Error("Seed admin did not return an id.");

  await transaction.query(
    `INSERT INTO memberships
       (organization_id, user_id, role_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'ACTIVE', now(), now())
     ON CONFLICT (organization_id, user_id) DO UPDATE SET
       role_id = EXCLUDED.role_id,
       status = 'ACTIVE',
       updated_at = now()`,
    [options.organizationId, userId, options.roleId],
  );
}

async function runSeed(): Promise<void> {
  const environment = seedEnvironmentSchema.parse(process.env);
  assertRbacCatalog();
  const passwordHash = await hashPassword(environment.SEED_ADMIN_PASSWORD);
  const database = createPostgresDatabase({ databaseUrl: environment.DATABASE_URL });

  try {
    await database.sqlTransaction(async (transaction) => {
      const organizationId = await seedOrganization(transaction);
      await seedPermissions(transaction);
      const roleIds = await seedRoles(transaction, organizationId);
      const roleId = roleIds.get("SUPER_ADMIN");
      if (roleId === undefined) throw new Error("SUPER_ADMIN role was not seeded.");
      await seedAdmin(transaction, {
        organizationId,
        roleId,
        email: environment.SEED_ADMIN_EMAIL,
        passwordHash,
      });
    });
    process.stdout.write("TraceLink seed completed for CH Market.\n");
  } finally {
    await database.close();
  }
}

void runSeed().catch((error: unknown) => {
  const message = error instanceof z.ZodError
    ? "Seed configuration is invalid. Check DATABASE_URL and SEED_ADMIN_* values."
    : "TraceLink seed failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

