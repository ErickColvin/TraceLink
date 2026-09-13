import assert from "node:assert/strict";

import { PERMISSIONS } from "@tracelink/contracts";

import { createPostgresDatabase } from "../../src/database/index.js";
import { ROLE_CATALOG } from "../../src/modules/roles/rbac-catalog.js";
import { verifyPassword } from "../../src/shared/security/password.js";

const databaseUrl = process.env["DATABASE_URL"];
const adminEmail = process.env["BOOTSTRAP_ADMIN_EMAIL"];
const adminPassword = process.env["BOOTSTRAP_ADMIN_PASSWORD"];

if (databaseUrl === undefined || adminEmail === undefined || adminPassword === undefined) {
  throw new Error("Bootstrap verification environment is incomplete.");
}

type BootstrapCounts = Readonly<{
  organizations: number;
  settings: number;
  permissions: number;
  roles: number;
  rolePermissions: number;
  users: number;
  memberships: number;
  commerceRows: number;
}>;

type AdminRow = Readonly<{
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  roleCode: string;
  membershipStatus: string;
}>;

const database = createPostgresDatabase({ databaseUrl, max: 2 });

try {
  const counts = await database.query<BootstrapCounts>(
    `SELECT
       (SELECT COUNT(*)::integer FROM organizations) AS organizations,
       (SELECT COUNT(*)::integer FROM organization_settings) AS settings,
       (SELECT COUNT(*)::integer FROM permissions) AS permissions,
       (SELECT COUNT(*)::integer FROM roles) AS roles,
       (SELECT COUNT(*)::integer FROM role_permissions) AS "rolePermissions",
       (SELECT COUNT(*)::integer FROM users) AS users,
       (SELECT COUNT(*)::integer FROM memberships) AS memberships,
       (
         (SELECT COUNT(*) FROM categories) +
         (SELECT COUNT(*) FROM customers) +
         (SELECT COUNT(*) FROM products) +
         (SELECT COUNT(*) FROM inventory_locations) +
         (SELECT COUNT(*) FROM inventory_lots) +
         (SELECT COUNT(*) FROM inventory_movements) +
         (SELECT COUNT(*) FROM inventory_reservations) +
         (SELECT COUNT(*) FROM orders) +
         (SELECT COUNT(*) FROM payments) +
         (SELECT COUNT(*) FROM packages) +
         (SELECT COUNT(*) FROM outbox_events)
       )::integer AS "commerceRows"`,
  );
  const expectedRolePermissions = ROLE_CATALOG.reduce(
    (total, role) => total + role.permissions.length,
    0,
  );
  assert.deepEqual(counts.rows[0], {
    organizations: 1,
    settings: 1,
    permissions: PERMISSIONS.length,
    roles: ROLE_CATALOG.length,
    rolePermissions: expectedRolePermissions,
    users: 1,
    memberships: 1,
    commerceRows: 0,
  });

  const admin = await database.query<AdminRow>(
    `SELECT
       u.email,
       u.first_name AS "firstName",
       u.last_name AS "lastName",
       u.password_hash AS "passwordHash",
       r.code AS "roleCode",
       m.status AS "membershipStatus"
     FROM users u
     JOIN memberships m ON m.user_id = u.id
     JOIN roles r ON r.id = m.role_id AND r.organization_id = m.organization_id
     JOIN organizations o ON o.id = m.organization_id
     WHERE o.slug = 'ch-market' AND u.email_normalized = $1`,
    [adminEmail.toLowerCase()],
  );
  assert.equal(admin.rows.length, 1);
  assert.deepEqual(
    admin.rows[0] === undefined
      ? undefined
      : {
          email: admin.rows[0].email,
          firstName: admin.rows[0].firstName,
          lastName: admin.rows[0].lastName,
          roleCode: admin.rows[0].roleCode,
          membershipStatus: admin.rows[0].membershipStatus,
        },
    {
      email: adminEmail,
      firstName: "Owner",
      lastName: "CH Market",
      roleCode: "SUPER_ADMIN",
      membershipStatus: "ACTIVE",
    },
  );
  assert.equal(
    await verifyPassword(admin.rows[0]?.passwordHash ?? "", adminPassword),
    true,
  );

  process.stdout.write(
    "Production bootstrap verification passed: minimal CH Market/RBAC dataset, valid owner credentials and no demo commerce data.\n",
  );
} finally {
  await database.close();
}
