import assert from "node:assert/strict";

import { PERMISSIONS, ROLE_CODES } from "@tracelink/contracts";

import { createPostgresDatabase } from "../../src/database/index.js";
import { verifyPickupCode } from "../../src/modules/packages/pickup-code.js";
import { runWithCleanup } from "./runner-lifecycle.js";

type CountRow = Readonly<{ total: number }>;
type IdentityRow = Readonly<{
  email: string;
  passwordHash: string;
  roleCode: string | null;
  status: string;
}>;
type InventorySummaryRow = Readonly<{
  physical: number;
  reserved: number;
  activeReservations: number;
  movementQuantity: number;
}>;
type SeedSummaryRow = Readonly<{
  organizationId: string;
  customerId: string;
  orderId: string;
  orderStatus: string;
  paymentStatus: string;
  subtotal: number;
  itemSubtotal: number;
  packageId: string;
  packageStatus: string;
  pickupCodeHash: Buffer;
  pickupDeadline: Date;
}>;

type VerifySeedOptions = Readonly<{
  adminEmail: string;
  databaseUrl: string;
  customerEmail: string;
  packagePickupCode: string;
  pickupCodeSecret: string;
  staffEmail: string;
}>;

async function count(
  database: ReturnType<typeof createPostgresDatabase>,
  table: string,
  organizationId?: string,
): Promise<number> {
  const tenantTables = new Set([
    "categories",
    "customers",
    "inventory_balances",
    "inventory_locations",
    "inventory_lots",
    "inventory_movements",
    "inventory_reservations",
    "memberships",
    "order_items",
    "order_status_events",
    "orders",
    "organization_settings",
    "packages",
    "products",
    "roles",
    "tracking_events",
  ]);
  assert.match(table, /^[a-z_]+$/u);
  const tenantScoped = tenantTables.has(table);
  const result = await database.query<CountRow>(
    `SELECT COUNT(*)::integer AS total FROM ${table}` +
      (tenantScoped ? " WHERE organization_id = $1" : ""),
    tenantScoped ? [organizationId] : [],
  );
  return result.rows[0]?.total ?? -1;
}

export async function verifySeedDataset(options: VerifySeedOptions): Promise<void> {
  const database = createPostgresDatabase({ databaseUrl: options.databaseUrl });
  return runWithCleanup(async () => {
    const summaryResult = await database.query<SeedSummaryRow>(
      `SELECT o.organization_id AS "organizationId",
              c.id AS "customerId",
              o.id AS "orderId", o.status AS "orderStatus",
              o.payment_status AS "paymentStatus", o.subtotal,
              COALESCE(SUM(oi.line_total), 0)::integer AS "itemSubtotal",
              p.id AS "packageId", p.status AS "packageStatus",
              p.pickup_code_hash AS "pickupCodeHash",
              p.pickup_deadline AS "pickupDeadline"
         FROM orders o
         JOIN customers c
           ON c.organization_id = o.organization_id AND c.id = o.customer_id
         JOIN packages p
           ON p.organization_id = o.organization_id AND p.order_id = o.id
         JOIN order_items oi
           ON oi.organization_id = o.organization_id AND oi.order_id = o.id
        WHERE o.order_number = 'CHM-E2E-1001'
          AND p.tracking_code = 'CHM-E2E-PKG-1001'
          AND c.email_normalized = $1
        GROUP BY o.organization_id, c.id, o.id, p.id`,
      [options.customerEmail.trim().toLowerCase()],
    );
    const summary = summaryResult.rows[0];
    assert.ok(summary, "The stable Phase 3 order/package dataset must exist.");
    assert.equal(summary.orderStatus, "PAID");
    assert.equal(summary.paymentStatus, "PAID");
    assert.equal(summary.packageStatus, "STORED");
    assert.equal(summary.itemSubtotal, summary.subtotal);
    assert.ok(summary.pickupDeadline.getTime() > Date.now());
    assert.equal(summary.pickupCodeHash.byteLength, 32);
    assert.equal(
      verifyPickupCode(
        options.pickupCodeSecret,
        summary.organizationId,
        summary.packageId,
        options.packagePickupCode,
        summary.pickupCodeHash,
      ),
      true,
    );

    const identityResult = await database.query<IdentityRow>(
      `SELECT u.email_normalized AS email, u.password_hash AS "passwordHash",
              u.status, r.code AS "roleCode"
         FROM users u
         LEFT JOIN memberships m
           ON m.user_id = u.id AND m.organization_id = $1
         LEFT JOIN roles r
           ON r.organization_id = m.organization_id AND r.id = m.role_id
        WHERE u.email_normalized = ANY($2::text[])
        ORDER BY u.email_normalized`,
      [
        summary.organizationId,
        [options.adminEmail, options.staffEmail, options.customerEmail].map(
          (email) => email.trim().toLowerCase(),
        ),
      ],
    );
    assert.equal(identityResult.rowCount, 3);
    const identities = new Map(identityResult.rows.map((row) => [row.email, row]));
    const admin = identities.get(options.adminEmail.trim().toLowerCase());
    const staff = identities.get(options.staffEmail.trim().toLowerCase());
    const customer = identities.get(options.customerEmail.trim().toLowerCase());
    assert.equal(admin?.roleCode, "SUPER_ADMIN");
    assert.equal(staff?.roleCode, "OPERATIONS");
    assert.equal(customer?.roleCode, null);
    for (const identity of identityResult.rows) {
      assert.equal(identity.status, "ACTIVE");
      assert.match(identity.passwordHash, /^\$argon2id\$/u);
    }

    const inventoryResult = await database.query<InventorySummaryRow>(
      `SELECT b.physical_quantity AS physical,
              b.reserved_quantity AS reserved,
              COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'ACTIVE'), 0)::integer
                AS "activeReservations",
              MAX(m.new_physical_quantity)::integer AS "movementQuantity"
         FROM inventory_balances b
         JOIN products product
           ON product.organization_id = b.organization_id
          AND product.id = b.product_id
         LEFT JOIN inventory_reservations r
           ON r.organization_id = b.organization_id
          AND r.product_id = b.product_id
          AND r.location_id = b.location_id
          AND r.lot_id = b.lot_id
         LEFT JOIN inventory_movements m
           ON m.organization_id = b.organization_id AND m.balance_id = b.id
        WHERE b.organization_id = $1 AND product.sku = 'CHM-ARROZ-001'
        GROUP BY b.id`,
      [summary.organizationId],
    );
    assert.deepEqual(inventoryResult.rows[0], {
      physical: 36,
      reserved: 2,
      activeReservations: 2,
      movementQuantity: 36,
    });

    const expectedCounts = {
      organizations: 1,
      permissions: PERMISSIONS.length,
      users: 3,
      roles: ROLE_CODES.length,
      memberships: 2,
      organization_settings: 1,
      customers: 1,
      categories: 3,
      products: 6,
      inventory_locations: 3,
      inventory_lots: 7,
      inventory_balances: 7,
      inventory_movements: 6,
      inventory_reservations: 1,
      orders: 4,
      order_items: 6,
      order_status_events: 10,
      packages: 3,
      tracking_events: 5,
    } as const;
    for (const [table, expected] of Object.entries(expectedCounts)) {
      assert.equal(
        await count(database, table, summary.organizationId),
        expected,
        `Unexpected ${table} count after running the seed twice.`,
      );
    }

    const superAdminPermissions = await database.query<CountRow>(
      `SELECT COUNT(*)::integer AS total
         FROM role_permissions rp
         JOIN roles r
           ON r.organization_id = rp.organization_id AND r.id = rp.role_id
        WHERE rp.organization_id = $1 AND r.code = 'SUPER_ADMIN'`,
      [summary.organizationId],
    );
    assert.equal(superAdminPermissions.rows[0]?.total, PERMISSIONS.length);
    process.stdout.write(
      "Seed verification passed after two executions: coherent counts, " +
        "identities/RBAC, inventory, stable E2E records and pickup hash.\n",
    );
  }, [
    { label: "conexiÃ³n PostgreSQL del verificador", run: () => database.close() },
  ]);
}
