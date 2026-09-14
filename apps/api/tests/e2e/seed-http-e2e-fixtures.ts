import type { PostgresDatabase, SqlExecutor } from "../../src/database/index.js";
import { hashPassword } from "../../src/shared/security/password.js";

type IdRow = Readonly<{ id: string }>;

export const HTTP_E2E_FIXTURES = Object.freeze({
  customerEmail: "customer@chmarket.test",
  customerPassword: "Test-Phase3-Admin!42",
  inventoryProductName: "Producto inventario E2E",
  orderNumber: "CHM-E2E-1001",
  packageTrackingCode: "CHM-E2E-PKG-1001",
  productCategoryName: "Categoría E2E",
});

function requiredId(row: IdRow | undefined, entity: string): string {
  if (row === undefined) {
    throw new Error(`No se pudo preparar el fixture E2E: ${entity}.`);
  }
  return row.id;
}

async function upsertCustomerUser(
  transaction: SqlExecutor,
  organizationId: string,
  passwordHash: string,
): Promise<string> {
  const email = HTTP_E2E_FIXTURES.customerEmail;
  const userResult = await transaction.query<IdRow>(
    `INSERT INTO users
       (email, email_normalized, first_name, last_name, password_hash, status,
        created_at, updated_at)
     VALUES ($1, $1, 'Cliente', 'E2E', $2, 'ACTIVE', now(), now())
     ON CONFLICT (email_normalized) DO UPDATE SET
       email = EXCLUDED.email,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       password_hash = EXCLUDED.password_hash,
       status = 'ACTIVE',
       updated_at = now()
     RETURNING id`,
    [email, passwordHash],
  );
  const userId = requiredId(userResult.rows[0], "usuario cliente");
  const customerResult = await transaction.query<IdRow>(
    `INSERT INTO customers
       (organization_id, user_id, first_name, last_name, email,
        email_normalized, phone, status, created_at, updated_at)
     VALUES ($1, $2, 'Cliente', 'E2E', $3, $3, '+56 9 1111 2222',
             'ACTIVE', now(), now())
     ON CONFLICT (organization_id, email_normalized) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       status = 'ACTIVE',
       updated_at = now()
     RETURNING id`,
    [organizationId, userId, email],
  );
  return requiredId(customerResult.rows[0], "perfil cliente");
}

async function upsertCatalog(
  transaction: SqlExecutor,
  organizationId: string,
): Promise<Readonly<{ productId: string; locationId: string }>> {
  const categoryResult = await transaction.query<IdRow>(
    `INSERT INTO categories
       (organization_id, slug, name, description, active, created_at, updated_at)
     VALUES ($1, 'categoria-e2e', $2, 'Datos exclusivos de pruebas HTTP.',
             true, now(), now())
     ON CONFLICT (organization_id, slug) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       active = true,
       updated_at = now()
     RETURNING id`,
    [organizationId, HTTP_E2E_FIXTURES.productCategoryName],
  );
  const categoryId = requiredId(categoryResult.rows[0], "categoría");
  const productResult = await transaction.query<IdRow>(
    `INSERT INTO products
       (organization_id, category_id, sku, slug, name, description, brand,
        sale_price, minimum_stock, active, published, featured,
        created_at, updated_at)
     VALUES ($1, $2, 'E2E-INV-1001', 'producto-inventario-e2e', $3,
             'Producto estable para movimientos E2E.', 'TraceLink',
             4990, 2, true, false, false, now(), now())
     ON CONFLICT (organization_id, sku) DO UPDATE SET
       category_id = EXCLUDED.category_id,
       slug = EXCLUDED.slug,
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       brand = EXCLUDED.brand,
       sale_price = EXCLUDED.sale_price,
       minimum_stock = EXCLUDED.minimum_stock,
       active = true,
       published = false,
       updated_at = now()
     RETURNING id`,
    [organizationId, categoryId, HTTP_E2E_FIXTURES.inventoryProductName],
  );
  const productId = requiredId(productResult.rows[0], "producto de inventario");
  const locationResult = await transaction.query<IdRow>(
    `INSERT INTO inventory_locations
       (organization_id, code, name, active, created_at, updated_at)
     VALUES ($1, 'E2E-01', 'Bodega E2E', true, now(), now())
     ON CONFLICT (organization_id, code) DO UPDATE SET
       name = EXCLUDED.name,
       active = true,
       updated_at = now()
     RETURNING id`,
    [organizationId],
  );
  const locationId = requiredId(locationResult.rows[0], "ubicación");
  const balanceResult = await transaction.query<IdRow>(
    `INSERT INTO inventory_balances
       (organization_id, product_id, location_id, lot_id,
        physical_quantity, reserved_quantity, updated_at)
     VALUES ($1, $2, $3, NULL, 10, 0, now())
     ON CONFLICT (organization_id, product_id, location_id)
       WHERE lot_id IS NULL
     DO UPDATE SET
       physical_quantity = 10,
       reserved_quantity = 0,
       updated_at = now()
     RETURNING id`,
    [organizationId, productId, locationId],
  );
  requiredId(balanceResult.rows[0], "saldo de inventario");
  return { productId, locationId };
}

async function upsertOrder(
  transaction: SqlExecutor,
  organizationId: string,
  customerId: string,
  productId: string,
): Promise<string> {
  const orderResult = await transaction.query<IdRow>(
    `INSERT INTO orders
       (organization_id, customer_id, order_number, status, payment_status,
        fulfillment_type, subtotal, discount, shipping, total, notes,
        created_at, updated_at)
     VALUES ($1, $2, $3, 'PAID', 'PAID', 'PICKUP', 9980, 0, 0, 9980,
             'Pedido de verificación Playwright HTTP.', now(), now())
     ON CONFLICT (organization_id, order_number) DO UPDATE SET
       customer_id = EXCLUDED.customer_id,
       status = 'PAID',
       payment_status = 'PAID',
       fulfillment_type = 'PICKUP',
       subtotal = 9980,
       discount = 0,
       shipping = 0,
       total = 9980,
       completed_at = NULL,
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING id`,
    [organizationId, customerId, HTTP_E2E_FIXTURES.orderNumber],
  );
  const orderId = requiredId(orderResult.rows[0], "pedido");
  await transaction.query(
    `DELETE FROM order_items
      WHERE organization_id = $1 AND order_id = $2`,
    [organizationId, orderId],
  );
  await transaction.query(
    `INSERT INTO order_items
       (organization_id, order_id, product_id, sku_snapshot,
        product_name_snapshot, unit_price, quantity, line_total)
     VALUES ($1, $2, $3, 'E2E-INV-1001', $4, 4990, 2, 9980)`,
    [
      organizationId,
      orderId,
      productId,
      HTTP_E2E_FIXTURES.inventoryProductName,
    ],
  );
  await transaction.query(
    `DELETE FROM order_status_events
      WHERE organization_id = $1 AND order_id = $2`,
    [organizationId, orderId],
  );
  await transaction.query(
    `INSERT INTO order_status_events
       (organization_id, order_id, from_status, to_status, actor_user_id,
        reason, occurred_at)
     VALUES ($1, $2, NULL, 'PAID', NULL, 'Pago confirmado para fixture E2E.', now())`,
    [organizationId, orderId],
  );
  return orderId;
}

async function upsertPackage(
  transaction: SqlExecutor,
  options: Readonly<{
    organizationId: string;
    customerId: string;
    orderId: string;
    locationId: string;
  }>,
): Promise<void> {
  const packageResult = await transaction.query<IdRow>(
    `INSERT INTO packages
       (organization_id, customer_id, order_id, tracking_code, carrier,
        description, item_count, requires_cold_storage, storage_location_id,
        status, received_at, stored_at, pickup_deadline, pickup_code_hash,
        pickup_code_consumed_at, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Blue Express', 'Contenido trazable E2E', 2,
             false, $5, 'STORED', now() - interval '2 hours',
             now() - interval '1 hour', now() + interval '14 days', NULL,
             NULL, 'Fixture Playwright sin código de retiro en texto plano.',
             now() - interval '2 hours', now())
     ON CONFLICT (organization_id, tracking_code) DO UPDATE SET
       customer_id = EXCLUDED.customer_id,
       order_id = EXCLUDED.order_id,
       carrier = EXCLUDED.carrier,
       description = EXCLUDED.description,
       item_count = EXCLUDED.item_count,
       requires_cold_storage = EXCLUDED.requires_cold_storage,
       storage_location_id = EXCLUDED.storage_location_id,
       status = 'STORED',
       received_at = EXCLUDED.received_at,
       stored_at = EXCLUDED.stored_at,
       ready_at = NULL,
       picked_up_at = NULL,
       pickup_deadline = EXCLUDED.pickup_deadline,
       pickup_code_hash = NULL,
       pickup_code_consumed_at = NULL,
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING id`,
    [
      options.organizationId,
      options.customerId,
      options.orderId,
      HTTP_E2E_FIXTURES.packageTrackingCode,
      options.locationId,
    ],
  );
  const packageId = requiredId(packageResult.rows[0], "paquete");
  await transaction.query(
    `DELETE FROM tracking_events
      WHERE organization_id = $1 AND package_id = $2`,
    [options.organizationId, packageId],
  );
  await transaction.query(
    `INSERT INTO tracking_events
       (organization_id, package_id, previous_status, new_status,
        description, location, actor_user_id, notes, occurred_at)
     VALUES
       ($1, $2, NULL, 'RECEIVED', 'Paquete recibido en CH Market.',
        'Bodega E2E', NULL, NULL, now() - interval '2 hours'),
       ($1, $2, 'RECEIVED', 'STORED', 'Paquete almacenado en Bodega E2E.',
        'Bodega E2E', NULL, NULL, now() - interval '1 hour')`,
    [options.organizationId, packageId],
  );
}

export async function seedHttpE2eFixtures(
  database: PostgresDatabase,
): Promise<void> {
  const passwordHash = await hashPassword(HTTP_E2E_FIXTURES.customerPassword);
  await database.sqlTransaction(async (transaction) => {
    const organization = await transaction.query<IdRow>(
      `SELECT id FROM organizations WHERE slug = 'ch-market' LIMIT 1`,
    );
    const organizationId = requiredId(organization.rows[0], "organización");
    await transaction.query(
      `INSERT INTO organization_settings
         (organization_id, contact_email, contact_phone, pickup_address,
          pickup_instructions, low_stock_threshold, package_alert_days,
          expiration_warning_days, created_at, updated_at)
       VALUES ($1, 'contacto@chmarket.test', '+56 2 2000 0000',
               'Sucursal E2E, Santiago', 'Presenta tu identificación.',
               5, 5, 30, now(), now())
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId],
    );
    const customerId = await upsertCustomerUser(
      transaction,
      organizationId,
      passwordHash,
    );
    const catalog = await upsertCatalog(transaction, organizationId);
    const orderId = await upsertOrder(
      transaction,
      organizationId,
      customerId,
      catalog.productId,
    );
    await upsertPackage(transaction, {
      organizationId,
      customerId,
      orderId,
      locationId: catalog.locationId,
    });
  });
}
