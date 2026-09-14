import "temporal-polyfill/full/global";

import { PERMISSIONS } from "@tracelink/contracts";

import { createPostgresDatabase, type SqlExecutor } from "../src/database/index.js";
import { hashPickupCode } from "../src/modules/packages/pickup-code.js";
import { ROLE_CATALOG, assertRbacCatalog } from "../src/modules/roles/rbac-catalog.js";
import { hashPassword } from "../src/shared/security/password.js";
import {
  parseSeedEnvironment,
  SeedEnvironmentValidationError,
} from "./seed-environment.js";

type IdRow = Readonly<{ id: string }>;
type SeedClockRow = Readonly<{ now: Date; todayStart: Date }>;

const IDS = Object.freeze({
  organization: "31000000-0000-4000-8000-000000000001",
  adminUser: "31000000-0000-4000-8000-000000000002",
  staffUser: "31000000-0000-4000-8000-000000000003",
  customerUser: "31000000-0000-4000-8000-000000000004",
  customer: "31000000-0000-4000-8000-000000000005",
  categories: [
    "31000000-0000-4000-8000-000000000101",
    "31000000-0000-4000-8000-000000000102",
    "31000000-0000-4000-8000-000000000103",
  ],
  products: [
    "31000000-0000-4000-8000-000000000201",
    "31000000-0000-4000-8000-000000000202",
    "31000000-0000-4000-8000-000000000203",
    "31000000-0000-4000-8000-000000000204",
    "31000000-0000-4000-8000-000000000205",
    "31000000-0000-4000-8000-000000000206",
  ],
  locations: [
    "31000000-0000-4000-8000-000000000301",
    "31000000-0000-4000-8000-000000000302",
    "31000000-0000-4000-8000-000000000303",
  ],
  lots: [
    "31000000-0000-4000-8000-000000000401",
    "31000000-0000-4000-8000-000000000402",
    "31000000-0000-4000-8000-000000000403",
    "31000000-0000-4000-8000-000000000404",
    "31000000-0000-4000-8000-000000000405",
    "31000000-0000-4000-8000-000000000406",
    "31000000-0000-4000-8000-000000000407",
  ],
  balances: [
    "31000000-0000-4000-8000-000000000501",
    "31000000-0000-4000-8000-000000000502",
    "31000000-0000-4000-8000-000000000503",
    "31000000-0000-4000-8000-000000000504",
    "31000000-0000-4000-8000-000000000505",
    "31000000-0000-4000-8000-000000000506",
    "31000000-0000-4000-8000-000000000507",
  ],
  orders: [
    "31000000-0000-4000-8000-000000000601",
    "31000000-0000-4000-8000-000000000602",
    "31000000-0000-4000-8000-000000000603",
    "31000000-0000-4000-8000-000000000604",
  ],
  reservation: "31000000-0000-4000-8000-000000000701",
  packages: [
    "31000000-0000-4000-8000-000000000801",
    "31000000-0000-4000-8000-000000000802",
    "31000000-0000-4000-8000-000000000803",
  ],
});

function requiredId(row: IdRow | undefined, entity: string): string {
  if (row === undefined) throw new Error(`${entity} seed did not return an id.`);
  return row.id;
}

function offsetDate(anchor: Date, days = 0, hours = 0): Date {
  return new Date(anchor.getTime() + days * 86_400_000 + hours * 3_600_000);
}

function calendarDate(anchor: Date, days: number): string {
  return offsetDate(anchor, days).toISOString().slice(0, 10);
}

async function seedOrganization(transaction: SqlExecutor): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO organizations
       (id, name, slug, locale, currency, timezone, active, created_at, updated_at)
     VALUES ($1, 'CH Market', 'ch-market', 'es-CL', 'CLP',
             'America/Santiago', true, now(), now())
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name, locale = EXCLUDED.locale,
       currency = EXCLUDED.currency, timezone = EXCLUDED.timezone,
       active = true, updated_at = now()
     RETURNING id`,
    [IDS.organization],
  );
  return requiredId(result.rows[0], "Organization");
}

async function seedSettings(transaction: SqlExecutor, organizationId: string): Promise<void> {
  await transaction.query(
    `INSERT INTO organization_settings
       (organization_id, contact_email, contact_phone, pickup_address,
        pickup_instructions, low_stock_threshold, package_alert_days,
        expiration_warning_days, created_at, updated_at)
     VALUES ($1, 'contacto@chmarket.test', '+56 9 4000 4000',
             'Av. Providencia 1234, Providencia, Santiago',
             'Presenta tu identificacion y el codigo privado de retiro.',
             6, 5, 30, now(), now())
     ON CONFLICT (organization_id) DO UPDATE SET
       contact_email = EXCLUDED.contact_email,
       contact_phone = EXCLUDED.contact_phone,
       pickup_address = EXCLUDED.pickup_address,
       pickup_instructions = EXCLUDED.pickup_instructions,
       low_stock_threshold = EXCLUDED.low_stock_threshold,
       package_alert_days = EXCLUDED.package_alert_days,
       expiration_warning_days = EXCLUDED.expiration_warning_days,
       updated_at = now()`,
    [organizationId],
  );
}

async function seedRbac(
  transaction: SqlExecutor,
  organizationId: string,
): Promise<ReadonlyMap<string, string>> {
  for (const permission of PERMISSIONS) {
    await transaction.query(
      `INSERT INTO permissions (key, description, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
      [permission, `Permiso TraceLink: ${permission}`],
    );
  }

  const ids = new Map<string, string>();
  for (const role of ROLE_CATALOG) {
    const result = await transaction.query<IdRow>(
      `INSERT INTO roles
         (organization_id, code, label, description, system, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (organization_id, code) DO UPDATE SET
         label = EXCLUDED.label, description = EXCLUDED.description,
         system = EXCLUDED.system, updated_at = now()
       RETURNING id`,
      [organizationId, role.code, role.label, role.description, role.system],
    );
    const roleId = requiredId(result.rows[0], `Role ${role.code}`);
    ids.set(role.code, roleId);
    await transaction.query(
      `DELETE FROM role_permissions WHERE organization_id = $1 AND role_id = $2`,
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

async function seedUser(
  transaction: SqlExecutor,
  input: Readonly<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  }>,
): Promise<string> {
  const email = input.email.trim();
  const result = await transaction.query<IdRow>(
    `INSERT INTO users
       (id, email, email_normalized, first_name, last_name, password_hash,
        status, email_verified_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', now(), now(), now())
     ON CONFLICT (email_normalized) DO UPDATE SET
       email = EXCLUDED.email, first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name, password_hash = EXCLUDED.password_hash,
       status = 'ACTIVE',
       email_verified_at = COALESCE(users.email_verified_at, now()),
       updated_at = now()
     RETURNING id`,
    [input.id, email, email.toLowerCase(), input.firstName, input.lastName, input.passwordHash],
  );
  return requiredId(result.rows[0], `User ${email}`);
}

async function seedMembership(
  transaction: SqlExecutor,
  organizationId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await transaction.query(
    `INSERT INTO memberships
       (organization_id, user_id, role_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'ACTIVE', now(), now())
     ON CONFLICT (organization_id, user_id) DO UPDATE SET
       role_id = EXCLUDED.role_id, status = 'ACTIVE', updated_at = now()`,
    [organizationId, userId, roleId],
  );
}

async function seedCustomer(
  transaction: SqlExecutor,
  organizationId: string,
  userId: string,
  email: string,
): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO customers
       (id, organization_id, user_id, first_name, last_name, email,
        email_normalized, phone, tax_id, address_line_1, commune, city, region,
        status, created_at, updated_at)
     VALUES ($1, $2, $3, 'Camila', 'Rojas', $4, $5, '+56 9 5555 0101',
             '12.345.678-5', 'Los Alerces 456', 'Nunoa', 'Santiago',
             'Region Metropolitana', 'ACTIVE', now(), now())
     ON CONFLICT (organization_id, email_normalized) DO UPDATE SET
       user_id = EXCLUDED.user_id, first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name, email = EXCLUDED.email,
       phone = EXCLUDED.phone, tax_id = EXCLUDED.tax_id,
       address_line_1 = EXCLUDED.address_line_1,
       commune = EXCLUDED.commune, city = EXCLUDED.city,
       region = EXCLUDED.region, status = 'ACTIVE', updated_at = now()
     RETURNING id`,
    [IDS.customer, organizationId, userId, email.trim(), email.trim().toLowerCase()],
  );
  return requiredId(result.rows[0], "Demo customer");
}

type CategorySeed = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string;
}>;

async function seedCategory(
  transaction: SqlExecutor,
  organizationId: string,
  category: CategorySeed,
): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO categories
       (id, organization_id, slug, name, description, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, now(), now())
     ON CONFLICT (organization_id, slug) DO UPDATE SET
       name = EXCLUDED.name, description = EXCLUDED.description,
       active = true, updated_at = now()
     RETURNING id`,
    [category.id, organizationId, category.slug, category.name, category.description],
  );
  return requiredId(result.rows[0], `Category ${category.slug}`);
}

type ProductSeed = Readonly<{
  id: string;
  categoryId: string;
  sku: string;
  barcode: string;
  slug: string;
  name: string;
  description: string;
  brand: string;
  salePrice: number;
  minimumStock: number;
  featured?: boolean;
}>;

async function seedProduct(
  transaction: SqlExecutor,
  organizationId: string,
  product: ProductSeed,
): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO products
       (id, organization_id, category_id, sku, barcode, slug, name,
        description, brand, sale_price, minimum_stock, published, active,
        featured, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             true, true, $12, now(), now())
     ON CONFLICT (organization_id, sku) DO UPDATE SET
       category_id = EXCLUDED.category_id, barcode = EXCLUDED.barcode,
       slug = EXCLUDED.slug, name = EXCLUDED.name,
       description = EXCLUDED.description, brand = EXCLUDED.brand,
       sale_price = EXCLUDED.sale_price,
       minimum_stock = EXCLUDED.minimum_stock,
       published = true, active = true, featured = EXCLUDED.featured,
       updated_at = now()
     RETURNING id`,
    [
      product.id,
      organizationId,
      product.categoryId,
      product.sku,
      product.barcode,
      product.slug,
      product.name,
      product.description,
      product.brand,
      product.salePrice,
      product.minimumStock,
      product.featured ?? false,
    ],
  );
  return requiredId(result.rows[0], `Product ${product.sku}`);
}

async function seedLocation(
  transaction: SqlExecutor,
  organizationId: string,
  location: Readonly<{ id: string; code: string; name: string }>,
): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO inventory_locations
       (id, organization_id, name, code, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, now(), now())
     ON CONFLICT (organization_id, code) DO UPDATE SET
       name = EXCLUDED.name, active = true, updated_at = now()
     RETURNING id`,
    [location.id, organizationId, location.name, location.code],
  );
  return requiredId(result.rows[0], `Location ${location.code}`);
}

async function seedLot(
  transaction: SqlExecutor,
  organizationId: string,
  lot: Readonly<{
    id: string;
    productId: string;
    lotNumber: string;
    expirationDate: string | null;
  }>,
): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO inventory_lots
       (id, organization_id, product_id, lot_number, expiration_date, created_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (organization_id, product_id, lot_number) DO UPDATE SET
       expiration_date = EXCLUDED.expiration_date
     RETURNING id`,
    [lot.id, organizationId, lot.productId, lot.lotNumber, lot.expirationDate],
  );
  return requiredId(result.rows[0], `Lot ${lot.lotNumber}`);
}

type BalanceSeed = Readonly<{
  id: string;
  productId: string;
  locationId: string;
  lotId: string;
  physical: number;
  reserved: number;
  origin: string;
  receivedDaysAgo: number;
}>;

async function seedBalance(
  transaction: SqlExecutor,
  organizationId: string,
  balance: BalanceSeed,
): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO inventory_balances
       (id, organization_id, product_id, location_id, lot_id,
        physical_quantity, reserved_quantity, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (organization_id, product_id, location_id, lot_id)
       WHERE lot_id IS NOT NULL
     DO UPDATE SET
       physical_quantity = EXCLUDED.physical_quantity,
       reserved_quantity = EXCLUDED.reserved_quantity,
       updated_at = now()
     RETURNING id`,
    [
      balance.id,
      organizationId,
      balance.productId,
      balance.locationId,
      balance.lotId,
      balance.physical,
      balance.reserved,
    ],
  );
  return requiredId(result.rows[0], `Balance ${balance.id}`);
}

async function seedMovement(
  transaction: SqlExecutor,
  input: Readonly<{
    id: string;
    organizationId: string;
    balance: BalanceSeed;
    balanceId: string;
    actorUserId: string;
    occurredAt: Date;
  }>,
): Promise<void> {
  await transaction.query(
    `INSERT INTO inventory_movements
       (id, organization_id, balance_id, product_id, location_id, lot_id,
        type, quantity_delta, previous_physical_quantity,
        new_physical_quantity, previous_reserved_quantity,
        new_reserved_quantity, actor_user_id, origin_location, reason, notes,
        created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'PURCHASE_RECEIPT', $7, 0, $7,
             0, 0, $8, $9, 'Carga inicial de inventario demo',
             'Registro generado por el seed idempotente de Fase 3.', $10)
     ON CONFLICT (id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       balance_id = EXCLUDED.balance_id,
       product_id = EXCLUDED.product_id,
       location_id = EXCLUDED.location_id,
       lot_id = EXCLUDED.lot_id, type = EXCLUDED.type,
       quantity_delta = EXCLUDED.quantity_delta,
       previous_physical_quantity = EXCLUDED.previous_physical_quantity,
       new_physical_quantity = EXCLUDED.new_physical_quantity,
       previous_reserved_quantity = EXCLUDED.previous_reserved_quantity,
       new_reserved_quantity = EXCLUDED.new_reserved_quantity,
       actor_user_id = EXCLUDED.actor_user_id,
       origin_location = EXCLUDED.origin_location,
       reason = EXCLUDED.reason, notes = EXCLUDED.notes,
       created_at = EXCLUDED.created_at`,
    [
      input.id,
      input.organizationId,
      input.balanceId,
      input.balance.productId,
      input.balance.locationId,
      input.balance.lotId,
      input.balance.physical,
      input.actorUserId,
      input.balance.origin,
      input.occurredAt,
    ],
  );
}

type OrderSeed = Readonly<{
  id: string;
  number: string;
  status: "PENDING_PAYMENT" | "PAID" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PENDING" | "PAID";
  fulfillment: "PICKUP" | "DELIVERY";
  subtotal: number;
  discount: number;
  shipping: number;
  estimatedReadyAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}>;

async function seedOrder(
  transaction: SqlExecutor,
  organizationId: string,
  customerId: string,
  order: OrderSeed,
): Promise<string> {
  const result = await transaction.query<IdRow>(
    `INSERT INTO orders
       (id, organization_id, customer_id, order_number, status, payment_status,
        fulfillment_type, subtotal, discount, shipping, total, notes,
        estimated_ready_at, completed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $8::integer - $9::integer + $10::integer,
             'Pedido demostrativo Fase 3.', $11, $12, $13, now())
     ON CONFLICT (organization_id, order_number) DO UPDATE SET
       customer_id = EXCLUDED.customer_id, status = EXCLUDED.status,
       payment_status = EXCLUDED.payment_status,
       fulfillment_type = EXCLUDED.fulfillment_type,
       subtotal = EXCLUDED.subtotal, discount = EXCLUDED.discount,
       shipping = EXCLUDED.shipping, total = EXCLUDED.total,
       notes = EXCLUDED.notes,
       estimated_ready_at = EXCLUDED.estimated_ready_at,
       completed_at = EXCLUDED.completed_at,
       created_at = EXCLUDED.created_at, updated_at = now()
     RETURNING id`,
    [
      order.id,
      organizationId,
      customerId,
      order.number,
      order.status,
      order.paymentStatus,
      order.fulfillment,
      order.subtotal,
      order.discount,
      order.shipping,
      order.estimatedReadyAt,
      order.completedAt,
      order.createdAt,
    ],
  );
  return requiredId(result.rows[0], `Order ${order.number}`);
}

type OrderItemSeed = Readonly<{
  id: string;
  orderId: string;
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}>;

async function seedOrderItem(
  transaction: SqlExecutor,
  organizationId: string,
  item: OrderItemSeed,
): Promise<void> {
  await transaction.query(
    `INSERT INTO order_items
       (id, organization_id, order_id, product_id, sku_snapshot,
        product_name_snapshot, unit_price, quantity, line_total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             $7::integer * $8::integer)
     ON CONFLICT (id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       order_id = EXCLUDED.order_id, product_id = EXCLUDED.product_id,
       sku_snapshot = EXCLUDED.sku_snapshot,
       product_name_snapshot = EXCLUDED.product_name_snapshot,
       unit_price = EXCLUDED.unit_price, quantity = EXCLUDED.quantity,
       line_total = EXCLUDED.line_total`,
    [
      item.id,
      organizationId,
      item.orderId,
      item.productId,
      item.sku,
      item.name,
      item.unitPrice,
      item.quantity,
    ],
  );
}

type OrderEventSeed = Readonly<{
  id: string;
  orderId: string;
  from: string | null;
  to: string;
  actorUserId: string | null;
  occurredAt: Date;
}>;

async function seedOrderEvent(
  transaction: SqlExecutor,
  organizationId: string,
  event: OrderEventSeed,
): Promise<void> {
  await transaction.query(
    `INSERT INTO order_status_events
       (id, organization_id, order_id, from_status, to_status, actor_user_id,
        reason, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Flujo demostrativo Fase 3.', $7)
     ON CONFLICT (id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       order_id = EXCLUDED.order_id, from_status = EXCLUDED.from_status,
       to_status = EXCLUDED.to_status, actor_user_id = EXCLUDED.actor_user_id,
       reason = EXCLUDED.reason, occurred_at = EXCLUDED.occurred_at`,
    [
      event.id,
      organizationId,
      event.orderId,
      event.from,
      event.to,
      event.actorUserId,
      event.occurredAt,
    ],
  );
}

type PackageSeed = Readonly<{
  id: string;
  customerId: string;
  orderId: string | null;
  trackingCode: string;
  carrier: string;
  description: string;
  itemCount: number;
  cold: boolean;
  locationId: string | null;
  status: "EXPECTED" | "STORED" | "INCIDENT";
  pickupCode: string | null;
  receivedAt: Date | null;
  storedAt: Date | null;
  pickupDeadline: Date | null;
  receivedByUserId: string | null;
  createdAt: Date;
}>;

async function seedPackage(
  transaction: SqlExecutor,
  organizationId: string,
  pickupCodeSecret: string,
  pkg: PackageSeed,
): Promise<string> {
  const existing = await transaction.query<IdRow>(
    `SELECT id FROM packages
      WHERE organization_id = $1 AND tracking_code = $2`,
    [organizationId, pkg.trackingCode],
  );
  const packageId = existing.rows[0]?.id ?? pkg.id;
  const pickupCodeHash = pkg.pickupCode === null
    ? null
    : hashPickupCode(
        pickupCodeSecret,
        organizationId,
        packageId,
        pkg.pickupCode,
      );
  const result = await transaction.query<IdRow>(
    `INSERT INTO packages
       (id, organization_id, customer_id, order_id, tracking_code, carrier,
        description, item_count, requires_cold_storage, weight_kg,
        storage_location_id, status, pickup_code_hash,
        pickup_code_consumed_at, received_at, stored_at, ready_at,
        pickup_deadline, picked_up_at, received_by_user_id, notes, created_at,
        updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1.25, $10, $11, $12,
             NULL, $13, $14, NULL, $15, NULL, $16,
             'Paquete demostrativo Fase 3.', $17, now())
     ON CONFLICT (organization_id, tracking_code) DO UPDATE SET
       customer_id = EXCLUDED.customer_id, order_id = EXCLUDED.order_id,
       carrier = EXCLUDED.carrier, description = EXCLUDED.description,
       item_count = EXCLUDED.item_count,
       requires_cold_storage = EXCLUDED.requires_cold_storage,
       weight_kg = EXCLUDED.weight_kg,
       storage_location_id = EXCLUDED.storage_location_id,
       status = EXCLUDED.status, pickup_code_hash = EXCLUDED.pickup_code_hash,
       pickup_code_consumed_at = NULL, received_at = EXCLUDED.received_at,
       stored_at = EXCLUDED.stored_at, ready_at = NULL,
       pickup_deadline = EXCLUDED.pickup_deadline, picked_up_at = NULL,
       received_by_user_id = EXCLUDED.received_by_user_id,
       notes = EXCLUDED.notes, created_at = EXCLUDED.created_at,
       updated_at = now()
     RETURNING id`,
    [
      packageId,
      organizationId,
      pkg.customerId,
      pkg.orderId,
      pkg.trackingCode,
      pkg.carrier,
      pkg.description,
      pkg.itemCount,
      pkg.cold,
      pkg.locationId,
      pkg.status,
      pickupCodeHash,
      pkg.receivedAt,
      pkg.storedAt,
      pkg.pickupDeadline,
      pkg.receivedByUserId,
      pkg.createdAt,
    ],
  );
  return requiredId(result.rows[0], `Package ${pkg.trackingCode}`);
}

type TrackingEventSeed = Readonly<{
  id: string;
  packageId: string;
  from: string | null;
  to: string;
  description: string;
  location: string | null;
  actorUserId: string | null;
  occurredAt: Date;
}>;

async function seedTrackingEvent(
  transaction: SqlExecutor,
  organizationId: string,
  event: TrackingEventSeed,
): Promise<void> {
  await transaction.query(
    `INSERT INTO tracking_events
       (id, organization_id, package_id, previous_status, new_status,
        description, location, actor_user_id, notes, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             'Evento generado por el seed de Fase 3.', $9)
     ON CONFLICT (id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       package_id = EXCLUDED.package_id,
       previous_status = EXCLUDED.previous_status,
       new_status = EXCLUDED.new_status,
       description = EXCLUDED.description, location = EXCLUDED.location,
       actor_user_id = EXCLUDED.actor_user_id, notes = EXCLUDED.notes,
       occurred_at = EXCLUDED.occurred_at`,
    [
      event.id,
      organizationId,
      event.packageId,
      event.from,
      event.to,
      event.description,
      event.location,
      event.actorUserId,
      event.occurredAt,
    ],
  );
}

async function seedCatalogAndInventory(
  transaction: SqlExecutor,
  organizationId: string,
  adminUserId: string,
  now: Date,
): Promise<Readonly<{
  products: readonly string[];
  locations: readonly string[];
  lots: readonly string[];
}>> {
  const pantryId = await seedCategory(transaction, organizationId, {
    id: IDS.categories[0]!,
    slug: "despensa",
    name: "Despensa",
    description: "Basicos para la cocina y productos de consumo diario.",
  });
  const drinksId = await seedCategory(transaction, organizationId, {
    id: IDS.categories[1]!,
    slug: "bebidas",
    name: "Bebidas",
    description: "Bebidas frias y calientes para cada momento.",
  });
  const careId = await seedCategory(transaction, organizationId, {
    id: IDS.categories[2]!,
    slug: "cuidado-personal",
    name: "Cuidado personal",
    description: "Productos esenciales para el cuidado cotidiano.",
  });

  const productSeeds: readonly ProductSeed[] = [
    {
      id: IDS.products[0]!,
      categoryId: pantryId,
      sku: "CHM-ARROZ-001",
      barcode: "7800000000011",
      slug: "arroz-premium-1kg",
      name: "Arroz premium 1 kg",
      description: "Arroz grado 1 de grano largo para preparaciones diarias.",
      brand: "CH Seleccion",
      salePrice: 2_490,
      minimumStock: 8,
      featured: true,
    },
    {
      id: IDS.products[1]!,
      categoryId: pantryId,
      sku: "CHM-ACEITE-001",
      barcode: "7800000000028",
      slug: "aceite-oliva-extra-virgen-500ml",
      name: "Aceite de oliva extra virgen 500 ml",
      description: "Aceite de oliva equilibrado para cocina y ensaladas.",
      brand: "Valle Central",
      salePrice: 6_990,
      minimumStock: 4,
    },
    {
      id: IDS.products[2]!,
      categoryId: drinksId,
      sku: "CHM-CAFE-001",
      barcode: "7800000000035",
      slug: "cafe-grano-500g",
      name: "Cafe en grano 500 g",
      description: "Cafe de tueste medio con notas de cacao y frutos secos.",
      brand: "Altura",
      salePrice: 8_990,
      minimumStock: 5,
      featured: true,
    },
    {
      id: IDS.products[3]!,
      categoryId: drinksId,
      sku: "CHM-AGUA-001",
      barcode: "7800000000042",
      slug: "agua-mineral-15l",
      name: "Agua mineral 1,5 L",
      description: "Agua mineral sin gas en botella retornable.",
      brand: "Cordillera",
      salePrice: 1_290,
      minimumStock: 12,
    },
    {
      id: IDS.products[4]!,
      categoryId: drinksId,
      sku: "CHM-LECHE-001",
      barcode: "7800000000059",
      slug: "leche-sin-lactosa-1l",
      name: "Leche sin lactosa 1 L",
      description: "Leche semidescremada sin lactosa; conservar refrigerada.",
      brand: "Campo Sur",
      salePrice: 1_490,
      minimumStock: 10,
      featured: true,
    },
    {
      id: IDS.products[5]!,
      categoryId: careId,
      sku: "CHM-JABON-001",
      barcode: "7800000000066",
      slug: "jabon-liquido-500ml",
      name: "Jabon liquido 500 ml",
      description: "Jabon liquido suave para uso frecuente.",
      brand: "Casa Clara",
      salePrice: 3_990,
      minimumStock: 4,
    },
  ];
  const products: string[] = [];
  for (const product of productSeeds) {
    products.push(await seedProduct(transaction, organizationId, product));
  }

  const locationSeeds = [
    { id: IDS.locations[0]!, code: "BOD-CENTRAL", name: "Bodega central" },
    { id: IDS.locations[1]!, code: "TIENDA", name: "Sala de ventas" },
    { id: IDS.locations[2]!, code: "FRIO", name: "Camara refrigerada" },
  ] as const;
  const locations: string[] = [];
  for (const location of locationSeeds) {
    locations.push(await seedLocation(transaction, organizationId, location));
  }

  const lotSeeds = [
    { id: IDS.lots[0]!, productId: products[0]!, lotNumber: "ARZ-DEMO-01", expirationDate: null },
    { id: IDS.lots[1]!, productId: products[1]!, lotNumber: "ACT-DEMO-01", expirationDate: calendarDate(now, 180) },
    { id: IDS.lots[2]!, productId: products[2]!, lotNumber: "CAF-DEMO-01", expirationDate: calendarDate(now, 90) },
    { id: IDS.lots[3]!, productId: products[3]!, lotNumber: "AGU-DEMO-01", expirationDate: calendarDate(now, 365) },
    { id: IDS.lots[4]!, productId: products[4]!, lotNumber: "LEC-DEMO-FRESCO", expirationDate: calendarDate(now, 12) },
    { id: IDS.lots[5]!, productId: products[4]!, lotNumber: "LEC-DEMO-VENCIDO", expirationDate: calendarDate(now, -3) },
    { id: IDS.lots[6]!, productId: products[5]!, lotNumber: "JAB-DEMO-01", expirationDate: null },
  ] as const;
  const lots: string[] = [];
  for (const lot of lotSeeds) {
    lots.push(await seedLot(transaction, organizationId, lot));
  }

  const balances: readonly BalanceSeed[] = [
    { id: IDS.balances[0]!, productId: products[0]!, locationId: locations[0]!, lotId: lots[0]!, physical: 36, reserved: 2, origin: "Proveedor Andes", receivedDaysAgo: 20 },
    { id: IDS.balances[1]!, productId: products[1]!, locationId: locations[0]!, lotId: lots[1]!, physical: 3, reserved: 0, origin: "Distribuidora Central", receivedDaysAgo: 18 },
    { id: IDS.balances[2]!, productId: products[2]!, locationId: locations[1]!, lotId: lots[2]!, physical: 18, reserved: 0, origin: "Tostaduria Altura", receivedDaysAgo: 15 },
    { id: IDS.balances[3]!, productId: products[3]!, locationId: locations[0]!, lotId: lots[3]!, physical: 48, reserved: 0, origin: "Aguas Cordillera", receivedDaysAgo: 12 },
    { id: IDS.balances[4]!, productId: products[4]!, locationId: locations[2]!, lotId: lots[4]!, physical: 5, reserved: 0, origin: "Lacteos Campo Sur", receivedDaysAgo: 2 },
    { id: IDS.balances[5]!, productId: products[4]!, locationId: locations[2]!, lotId: lots[5]!, physical: 8, reserved: 0, origin: "Lacteos Campo Sur", receivedDaysAgo: 40 },
    { id: IDS.balances[6]!, productId: products[5]!, locationId: locations[1]!, lotId: lots[6]!, physical: 0, reserved: 0, origin: "Casa Clara", receivedDaysAgo: 10 },
  ];
  for (let index = 0; index < balances.length; index += 1) {
    const balance = balances[index]!;
    const balanceId = await seedBalance(transaction, organizationId, balance);
    if (balance.physical > 0) {
      await seedMovement(transaction, {
        id: `31000000-0000-4000-8000-${String(901 + index).padStart(12, "0")}`,
        organizationId,
        balance,
        balanceId,
        actorUserId: adminUserId,
        occurredAt: offsetDate(now, -balance.receivedDaysAgo),
      });
    }
  }
  return { products, locations, lots };
}

async function seedOrdersAndPackages(
  transaction: SqlExecutor,
  input: Readonly<{
    organizationId: string;
    customerId: string;
    staffUserId: string;
    products: readonly string[];
    locations: readonly string[];
    lots: readonly string[];
    pickupCode: string;
    pickupCodeSecret: string;
    now: Date;
    todayStart: Date;
  }>,
): Promise<void> {
  const todayElapsed = Math.max(input.now.getTime() - input.todayStart.getTime(), 0);
  const todayMarker = new Date(input.todayStart.getTime() + Math.floor(todayElapsed / 2));
  const orders: readonly OrderSeed[] = [
    {
      id: IDS.orders[0]!,
      number: "CHM-E2E-1001",
      status: "PAID",
      paymentStatus: "PAID",
      fulfillment: "PICKUP",
      subtotal: 13_970,
      discount: 1_000,
      shipping: 0,
      estimatedReadyAt: offsetDate(input.now, 0, -1),
      completedAt: null,
      createdAt: todayMarker,
    },
    {
      id: IDS.orders[1]!,
      number: "CHM-DEMO-1002",
      status: "COMPLETED",
      paymentStatus: "PAID",
      fulfillment: "PICKUP",
      subtotal: 6_970,
      discount: 0,
      shipping: 0,
      estimatedReadyAt: offsetDate(input.now, -2, 2),
      completedAt: offsetDate(input.now, -2, 3),
      createdAt: offsetDate(input.now, -2),
    },
    {
      id: IDS.orders[2]!,
      number: "CHM-DEMO-1003",
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      fulfillment: "DELIVERY",
      subtotal: 7_740,
      discount: 0,
      shipping: 2_990,
      estimatedReadyAt: offsetDate(input.now, 0, 4),
      completedAt: null,
      createdAt: todayMarker,
    },
    {
      id: IDS.orders[3]!,
      number: "CHM-DEMO-1004",
      status: "CANCELLED",
      paymentStatus: "PENDING",
      fulfillment: "PICKUP",
      subtotal: 6_990,
      discount: 0,
      shipping: 0,
      estimatedReadyAt: null,
      completedAt: null,
      createdAt: offsetDate(input.now, -4),
    },
  ];
  const orderIds: string[] = [];
  for (const order of orders) {
    orderIds.push(
      await seedOrder(transaction, input.organizationId, input.customerId, order),
    );
  }

  await transaction.query(
    `DELETE FROM order_status_events
      WHERE organization_id = $1 AND order_id = ANY($2::uuid[])`,
    [input.organizationId, orderIds],
  );
  await transaction.query(
    `DELETE FROM order_items
      WHERE organization_id = $1 AND order_id = ANY($2::uuid[])`,
    [input.organizationId, orderIds],
  );
  await transaction.query(
    `DELETE FROM inventory_reservations
      WHERE organization_id = $1 AND order_id = ANY($2::uuid[])`,
    [input.organizationId, orderIds],
  );

  const items: readonly OrderItemSeed[] = [
    { id: "31000000-0000-4000-8000-000000001001", orderId: orderIds[0]!, productId: input.products[0]!, sku: "CHM-ARROZ-001", name: "Arroz premium 1 kg", unitPrice: 2_490, quantity: 2 },
    { id: "31000000-0000-4000-8000-000000001002", orderId: orderIds[0]!, productId: input.products[2]!, sku: "CHM-CAFE-001", name: "Cafe en grano 500 g", unitPrice: 8_990, quantity: 1 },
    { id: "31000000-0000-4000-8000-000000001003", orderId: orderIds[1]!, productId: input.products[4]!, sku: "CHM-LECHE-001", name: "Leche sin lactosa 1 L", unitPrice: 1_490, quantity: 2 },
    { id: "31000000-0000-4000-8000-000000001004", orderId: orderIds[1]!, productId: input.products[5]!, sku: "CHM-JABON-001", name: "Jabon liquido 500 ml", unitPrice: 3_990, quantity: 1 },
    { id: "31000000-0000-4000-8000-000000001005", orderId: orderIds[2]!, productId: input.products[3]!, sku: "CHM-AGUA-001", name: "Agua mineral 1,5 L", unitPrice: 1_290, quantity: 6 },
    { id: "31000000-0000-4000-8000-000000001006", orderId: orderIds[3]!, productId: input.products[1]!, sku: "CHM-ACEITE-001", name: "Aceite de oliva extra virgen 500 ml", unitPrice: 6_990, quantity: 1 },
  ];
  for (const item of items) {
    await seedOrderItem(transaction, input.organizationId, item);
  }

  const events: readonly OrderEventSeed[] = [
    { id: "31000000-0000-4000-8000-000000001101", orderId: orderIds[0]!, from: null, to: "PENDING_PAYMENT", actorUserId: null, occurredAt: offsetDate(todayMarker, 0, -0.2) },
    { id: "31000000-0000-4000-8000-000000001102", orderId: orderIds[0]!, from: "PENDING_PAYMENT", to: "PAID", actorUserId: input.staffUserId, occurredAt: todayMarker },
    { id: "31000000-0000-4000-8000-000000001103", orderId: orderIds[1]!, from: null, to: "PENDING_PAYMENT", actorUserId: null, occurredAt: offsetDate(input.now, -2, -1) },
    { id: "31000000-0000-4000-8000-000000001104", orderId: orderIds[1]!, from: "PENDING_PAYMENT", to: "PAID", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -2) },
    { id: "31000000-0000-4000-8000-000000001105", orderId: orderIds[1]!, from: "PAID", to: "PREPARING", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -2, 1) },
    { id: "31000000-0000-4000-8000-000000001106", orderId: orderIds[1]!, from: "PREPARING", to: "READY", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -2, 2) },
    { id: "31000000-0000-4000-8000-000000001107", orderId: orderIds[1]!, from: "READY", to: "COMPLETED", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -2, 3) },
    { id: "31000000-0000-4000-8000-000000001108", orderId: orderIds[2]!, from: null, to: "PENDING_PAYMENT", actorUserId: null, occurredAt: todayMarker },
    { id: "31000000-0000-4000-8000-000000001109", orderId: orderIds[3]!, from: null, to: "PENDING_PAYMENT", actorUserId: null, occurredAt: offsetDate(input.now, -4) },
    { id: "31000000-0000-4000-8000-000000001110", orderId: orderIds[3]!, from: "PENDING_PAYMENT", to: "CANCELLED", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -4, 1) },
  ];
  for (const event of events) {
    await seedOrderEvent(transaction, input.organizationId, event);
  }

  await transaction.query(
    `INSERT INTO inventory_reservations
       (id, organization_id, order_id, product_id, location_id, lot_id,
        quantity, status, expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 2, 'ACTIVE', $7, $8, now())
     ON CONFLICT (id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       order_id = EXCLUDED.order_id, product_id = EXCLUDED.product_id,
       location_id = EXCLUDED.location_id, lot_id = EXCLUDED.lot_id,
       quantity = EXCLUDED.quantity, status = EXCLUDED.status,
       expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at,
       updated_at = now()`,
    [
      IDS.reservation,
      input.organizationId,
      orderIds[0],
      input.products[0],
      input.locations[0],
      input.lots[0],
      offsetDate(input.now, 1),
      todayMarker,
    ],
  );

  const packageSeeds: readonly PackageSeed[] = [
    {
      id: IDS.packages[0]!,
      customerId: input.customerId,
      orderId: orderIds[0]!,
      trackingCode: "CHM-E2E-PKG-1001",
      carrier: "Chilexpress",
      description: "Compra nacional en custodia para retiro.",
      itemCount: 2,
      cold: false,
      locationId: input.locations[0]!,
      status: "STORED",
      pickupCode: input.pickupCode,
      receivedAt: offsetDate(input.now, -7),
      storedAt: offsetDate(input.now, -6),
      pickupDeadline: offsetDate(input.now, 23),
      receivedByUserId: input.staffUserId,
      createdAt: offsetDate(input.now, -8),
    },
    {
      id: IDS.packages[1]!,
      customerId: input.customerId,
      orderId: orderIds[2]!,
      trackingCode: "CHM-DEMO-PKG-1002",
      carrier: "Blue Express",
      description: "Paquete anunciado, pendiente de recepcion.",
      itemCount: 1,
      cold: false,
      locationId: null,
      status: "EXPECTED",
      pickupCode: null,
      receivedAt: null,
      storedAt: null,
      pickupDeadline: null,
      receivedByUserId: null,
      createdAt: offsetDate(input.now, -1),
    },
    {
      id: IDS.packages[2]!,
      customerId: input.customerId,
      orderId: orderIds[1]!,
      trackingCode: "CHM-DEMO-PKG-1003",
      carrier: "Starken",
      description: "Paquete con embalaje exterior danado; requiere revision.",
      itemCount: 3,
      cold: true,
      locationId: input.locations[2]!,
      status: "INCIDENT",
      pickupCode: input.pickupCode,
      receivedAt: offsetDate(input.now, -1, -3),
      storedAt: null,
      pickupDeadline: offsetDate(input.now, 29),
      receivedByUserId: input.staffUserId,
      createdAt: offsetDate(input.now, -2),
    },
  ];
  const packageIds: string[] = [];
  for (const pkg of packageSeeds) {
    packageIds.push(
      await seedPackage(
        transaction,
        input.organizationId,
        input.pickupCodeSecret,
        pkg,
      ),
    );
  }
  await transaction.query(
    `DELETE FROM package_pickup_receipts
      WHERE organization_id = $1 AND package_id = ANY($2::uuid[])`,
    [input.organizationId, packageIds],
  );
  await transaction.query(
    `DELETE FROM tracking_events
      WHERE organization_id = $1 AND package_id = ANY($2::uuid[])`,
    [input.organizationId, packageIds],
  );
  const trackingEvents: readonly TrackingEventSeed[] = [
    { id: "31000000-0000-4000-8000-000000001201", packageId: packageIds[0]!, from: null, to: "RECEIVED", description: "Paquete recibido en CH Market.", location: "Bodega central", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -7) },
    { id: "31000000-0000-4000-8000-000000001202", packageId: packageIds[0]!, from: "RECEIVED", to: "STORED", description: "Paquete almacenado y disponible para preparar su retiro.", location: "Bodega central", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -6) },
    { id: "31000000-0000-4000-8000-000000001203", packageId: packageIds[1]!, from: null, to: "EXPECTED", description: "Arribo informado por el transportista.", location: null, actorUserId: null, occurredAt: offsetDate(input.now, -1) },
    { id: "31000000-0000-4000-8000-000000001204", packageId: packageIds[2]!, from: null, to: "RECEIVED", description: "Paquete recibido en camara refrigerada.", location: "Camara refrigerada", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -1, -3) },
    { id: "31000000-0000-4000-8000-000000001205", packageId: packageIds[2]!, from: "RECEIVED", to: "INCIDENT", description: "Embalaje exterior danado; inspeccion operativa pendiente.", location: "Camara refrigerada", actorUserId: input.staffUserId, occurredAt: offsetDate(input.now, -1, -2) },
  ];
  for (const event of trackingEvents) {
    await seedTrackingEvent(transaction, input.organizationId, event);
  }
}

async function runSeed(): Promise<void> {
  const environment = parseSeedEnvironment(process.env);
  assertRbacCatalog();
  const [adminPasswordHash, staffPasswordHash, customerPasswordHash] =
    await Promise.all([
      hashPassword(environment.SEED_ADMIN_PASSWORD),
      hashPassword(environment.SEED_STAFF_PASSWORD ?? environment.SEED_ADMIN_PASSWORD),
      hashPassword(environment.SEED_CUSTOMER_PASSWORD ?? environment.SEED_ADMIN_PASSWORD),
    ]);
  const database = createPostgresDatabase({ databaseUrl: environment.DATABASE_URL });

  try {
    await database.sqlTransaction(async (transaction) => {
      const organizationId = await seedOrganization(transaction);
      await seedSettings(transaction, organizationId);
      const roleIds = await seedRbac(transaction, organizationId);
      const superAdminRoleId = roleIds.get("SUPER_ADMIN");
      const operationsRoleId = roleIds.get("OPERATIONS");
      if (superAdminRoleId === undefined || operationsRoleId === undefined) {
        throw new Error("Required demo roles were not seeded.");
      }

      const adminUserId = await seedUser(transaction, {
        id: IDS.adminUser,
        email: environment.SEED_ADMIN_EMAIL,
        firstName: "Administrador",
        lastName: "CH Market",
        passwordHash: adminPasswordHash,
      });
      await seedMembership(
        transaction,
        organizationId,
        adminUserId,
        superAdminRoleId,
      );

      const staffUserId = await seedUser(transaction, {
        id: IDS.staffUser,
        email: environment.SEED_STAFF_EMAIL,
        firstName: "Sofia",
        lastName: "Operaciones",
        passwordHash: staffPasswordHash,
      });
      await seedMembership(
        transaction,
        organizationId,
        staffUserId,
        operationsRoleId,
      );

      const customerUserId = await seedUser(transaction, {
        id: IDS.customerUser,
        email: environment.SEED_CUSTOMER_EMAIL,
        firstName: "Camila",
        lastName: "Rojas",
        passwordHash: customerPasswordHash,
      });
      const customerId = await seedCustomer(
        transaction,
        organizationId,
        customerUserId,
        environment.SEED_CUSTOMER_EMAIL,
      );

      const clockResult = await transaction.query<SeedClockRow>(
        `SELECT now() AS "now",
                ((now() AT TIME ZONE 'America/Santiago')::date::timestamp
                  AT TIME ZONE 'America/Santiago') AS "todayStart"`,
      );
      const clock = clockResult.rows[0];
      if (clock === undefined) throw new Error("Seed clock query returned no row.");
      const inventory = await seedCatalogAndInventory(
        transaction,
        organizationId,
        adminUserId,
        clock.now,
      );
      await seedOrdersAndPackages(transaction, {
        organizationId,
        customerId,
        staffUserId,
        products: inventory.products,
        locations: inventory.locations,
        lots: inventory.lots,
        pickupCode: environment.SEED_PACKAGE_PICKUP_CODE,
        pickupCodeSecret: environment.PICKUP_CODE_SECRET,
        now: clock.now,
        todayStart: clock.todayStart,
      });
    });
    process.stdout.write(
      "TraceLink seed completed for CH Market: 3 identities, 6 products, " +
        "4 orders and 3 packages.\n",
    );
  } finally {
    await database.close();
  }
}

void runSeed().catch((error: unknown) => {
  const message = error instanceof SeedEnvironmentValidationError
    ? error.message
    : `TraceLink seed failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
