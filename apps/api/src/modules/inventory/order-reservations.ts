import type { SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";

export type ReservationRequestItem = Readonly<{
  productId: string;
  quantity: number;
}>;

export type OrderReservation = Readonly<{
  id: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  quantity: number;
  expiresAt: Date;
}>;

type ProductRow = Readonly<{
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  published: boolean;
  active: boolean;
}>;

export type CheckoutProduct = Readonly<{
  id: string;
  sku: string;
  name: string;
  salePrice: number;
  quantity: number;
  lineTotal: number;
}>;

type BalanceRow = Readonly<{
  id: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  physicalQuantity: number;
  reservedQuantity: number;
  locationName: string;
}>;

type ReservationRow = Readonly<{
  id: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  quantity: number;
  expiresAt: Date;
}>;

function insufficientStock(productName: string): AppError {
  return new AppError({
    statusCode: 409,
    code: "INSUFFICIENT_STOCK",
    message: `No existe stock disponible suficiente para ${productName}.`,
  });
}

function normalizeItems(items: readonly ReservationRequestItem[]): readonly ReservationRequestItem[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId));
}

export async function loadCheckoutProducts(
  executor: SqlExecutor,
  organizationId: string,
  items: readonly ReservationRequestItem[],
): Promise<readonly CheckoutProduct[]> {
  const normalized = normalizeItems(items);
  const productIds = normalized.map((item) => item.productId);
  const result = await executor.query<ProductRow>(
    `SELECT id, sku, name, sale_price AS "salePrice", published, active
       FROM products
      WHERE organization_id = $1 AND id = ANY($2::uuid[])
      ORDER BY id ASC
      FOR SHARE`,
    [organizationId, productIds],
  );
  if (result.rows.length !== normalized.length) {
    throw new AppError({
      statusCode: 404,
      code: "PRODUCT_NOT_FOUND",
      message: "Uno o más productos del carrito no existen.",
    });
  }
  const byId = new Map(result.rows.map((product) => [product.id, product]));
  return normalized.map((item) => {
    const product = byId.get(item.productId);
    if (product === undefined) throw new Error("Product lookup invariant failed.");
    if (!product.active || !product.published) {
      throw new AppError({
        statusCode: 409,
        code: "PRODUCT_UNAVAILABLE",
        message: `${product.name} ya no está disponible para compra.`,
      });
    }
    const lineTotal = product.salePrice * item.quantity;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new AppError({
        statusCode: 409,
        code: "ORDER_TOTAL_OVERFLOW",
        message: "El total del pedido supera el límite permitido.",
      });
    }
    return { ...product, quantity: item.quantity, lineTotal };
  });
}

export async function reserveOrderInventory(
  executor: SqlExecutor,
  options: Readonly<{
    organizationId: string;
    orderId: string;
    products: readonly CheckoutProduct[];
    expiresAt: Date;
    actorUserId: string;
    requestId: string;
  }>,
): Promise<readonly OrderReservation[]> {
  const reservations: OrderReservation[] = [];
  for (const product of [...options.products].sort((a, b) => a.id.localeCompare(b.id))) {
    const balances = await executor.query<BalanceRow>(
      `SELECT balance.id, balance.product_id AS "productId",
              balance.location_id AS "locationId", balance.lot_id AS "lotId",
              balance.physical_quantity AS "physicalQuantity",
              balance.reserved_quantity AS "reservedQuantity",
              location.name AS "locationName"
         FROM inventory_balances balance
         JOIN inventory_locations location
           ON location.organization_id = balance.organization_id
          AND location.id = balance.location_id
         LEFT JOIN inventory_lots lot
           ON lot.organization_id = balance.organization_id
          AND lot.id = balance.lot_id
        WHERE balance.organization_id = $1
          AND balance.product_id = $2
          AND location.active = true
          AND (lot.id IS NULL OR lot.expiration_date >= CURRENT_DATE)
          AND balance.physical_quantity > balance.reserved_quantity
        ORDER BY lot.expiration_date ASC NULLS LAST,
                 lot.created_at ASC NULLS LAST, balance.id ASC
        FOR UPDATE OF balance`,
      [options.organizationId, product.id],
    );
    const available = balances.rows.reduce(
      (total, balance) => total + balance.physicalQuantity - balance.reservedQuantity,
      0,
    );
    if (available < product.quantity) throw insufficientStock(product.name);

    let remaining = product.quantity;
    for (const balance of balances.rows) {
      if (remaining === 0) break;
      const quantity = Math.min(
        remaining,
        balance.physicalQuantity - balance.reservedQuantity,
      );
      if (quantity <= 0) continue;
      await executor.query(
        `UPDATE inventory_balances
            SET reserved_quantity = reserved_quantity + $3, updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [options.organizationId, balance.id, quantity],
      );
      const inserted = await executor.query<ReservationRow>(
        `INSERT INTO inventory_reservations
           (organization_id, order_id, product_id, location_id, lot_id,
            quantity, status, expires_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, now())
         RETURNING id, product_id AS "productId", location_id AS "locationId",
                   lot_id AS "lotId", quantity, expires_at AS "expiresAt"`,
        [
          options.organizationId,
          options.orderId,
          product.id,
          balance.locationId,
          balance.lotId,
          quantity,
          options.expiresAt,
        ],
      );
      const reservation = inserted.rows[0];
      if (reservation === undefined) throw new Error("Reservation insert returned no row.");
      reservations.push(reservation);
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "inventory.reservation.create",
        entityType: "InventoryReservation",
        entityId: reservation.id,
        after: {
          orderId: options.orderId,
          productId: product.id,
          locationId: balance.locationId,
          lotId: balance.lotId,
          quantity,
          status: "ACTIVE",
          expiresAt: options.expiresAt.toISOString(),
        },
        requestId: options.requestId,
      });
      remaining -= quantity;
    }
  }
  return reservations;
}

type ReservationLifecycleRow = Readonly<{
  id: string;
  status: "ACTIVE" | "COMMITTED" | "CONSUMED" | "RELEASED" | "EXPIRED";
  productId: string;
  locationId: string;
  lotId: string | null;
  quantity: number;
  expiresAt: Date;
  balanceId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  locationName: string;
}>;

async function lockOrderReservations(
  executor: SqlExecutor,
  organizationId: string,
  orderId: string,
): Promise<readonly ReservationLifecycleRow[]> {
  const result = await executor.query<ReservationLifecycleRow>(
    `SELECT reservation.id, reservation.status,
            reservation.product_id AS "productId",
            reservation.location_id AS "locationId",
            reservation.lot_id AS "lotId", reservation.quantity,
            reservation.expires_at AS "expiresAt", balance.id AS "balanceId",
            balance.physical_quantity AS "physicalQuantity",
            balance.reserved_quantity AS "reservedQuantity",
            location.name AS "locationName"
       FROM inventory_reservations reservation
       JOIN inventory_balances balance
         ON balance.organization_id = reservation.organization_id
        AND balance.product_id = reservation.product_id
        AND balance.location_id = reservation.location_id
        AND balance.lot_id IS NOT DISTINCT FROM reservation.lot_id
       JOIN inventory_locations location
         ON location.organization_id = balance.organization_id
        AND location.id = balance.location_id
      WHERE reservation.organization_id = $1 AND reservation.order_id = $2
      ORDER BY reservation.id ASC
      FOR UPDATE OF reservation, balance`,
    [organizationId, orderId],
  );
  return result.rows;
}

export async function commitOrderReservations(
  executor: SqlExecutor,
  options: Readonly<{
    organizationId: string;
    orderId: string;
    requestId: string;
  }>,
): Promise<number> {
  const reservations = await lockOrderReservations(
    executor,
    options.organizationId,
    options.orderId,
  );
  let committed = 0;
  for (const reservation of reservations) {
    if (reservation.status !== "ACTIVE") continue;
    await executor.query(
      `UPDATE inventory_reservations SET status = 'COMMITTED', updated_at = now()
        WHERE organization_id = $1 AND id = $2 AND status = 'ACTIVE'`,
      [options.organizationId, reservation.id],
    );
    await writeAudit(executor, {
      organizationId: options.organizationId,
      action: "inventory.reservation.commit",
      entityType: "InventoryReservation",
      entityId: reservation.id,
      before: { status: "ACTIVE" },
      after: { status: "COMMITTED" },
      requestId: options.requestId,
    });
    committed += 1;
  }
  return committed;
}

export async function releaseOrderReservations(
  executor: SqlExecutor,
  options: Readonly<{
    organizationId: string;
    orderId: string;
    requestId: string;
    reason: "cancelled" | "rejected" | "expired";
  }>,
): Promise<number> {
  const reservations = await lockOrderReservations(executor, options.organizationId, options.orderId);
  let released = 0;
  for (const reservation of reservations) {
    if (reservation.status !== "ACTIVE") continue;
    if (reservation.reservedQuantity < reservation.quantity) {
      throw new AppError({
        statusCode: 409,
        code: "INVENTORY_INTEGRITY_CONFLICT",
        message: "Las cantidades reservadas no son consistentes.",
      });
    }
    await executor.query(
      `UPDATE inventory_balances
          SET reserved_quantity = reserved_quantity - $3, updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, reservation.balanceId, reservation.quantity],
    );
    const status = options.reason === "expired" ? "EXPIRED" : "RELEASED";
    await executor.query(
      `UPDATE inventory_reservations SET status = $3, updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, reservation.id, status],
    );
    await writeAudit(executor, {
      organizationId: options.organizationId,
      action: `inventory.reservation.${options.reason}`,
      entityType: "InventoryReservation",
      entityId: reservation.id,
      before: { status: "ACTIVE" },
      after: { status },
      requestId: options.requestId,
    });
    released += 1;
  }
  return released;
}

export async function consumeCommittedOrderReservations(
  executor: SqlExecutor,
  options: Readonly<{
    organizationId: string;
    orderId: string;
    actorUserId: string;
    requestId: string;
  }>,
): Promise<number> {
  const reservations = await lockOrderReservations(executor, options.organizationId, options.orderId);
  let consumed = 0;
  for (const reservation of reservations) {
    if (reservation.status === "CONSUMED") continue;
    if (reservation.status !== "COMMITTED") {
      throw new AppError({
        statusCode: 409,
        code: "INVALID_RESERVATION_STATE",
        message: "El pedido no tiene reservas comprometidas listas para consumir.",
      });
    }
    if (
      reservation.reservedQuantity < reservation.quantity ||
      reservation.physicalQuantity < reservation.quantity
    ) {
      throw new AppError({
        statusCode: 409,
        code: "INVENTORY_INTEGRITY_CONFLICT",
        message: "Las cantidades reservadas no son consistentes.",
      });
    }
    const inserted = await executor.query(
      `INSERT INTO inventory_movements
         (organization_id, balance_id, reservation_id, product_id, location_id,
          lot_id, type, quantity_delta, previous_physical_quantity,
          new_physical_quantity, previous_reserved_quantity,
          new_reserved_quantity, actor_user_id, origin_location,
          destination_location, reason)
       VALUES ($1, $2, $3, $4, $5, $6, 'SALE', $7, $8, $9, $10, $11,
               $12, $13, 'Pedido', 'Consumo de reserva')
       ON CONFLICT (organization_id, reservation_id) WHERE reservation_id IS NOT NULL
       DO NOTHING`,
      [
        options.organizationId,
        reservation.balanceId,
        reservation.id,
        reservation.productId,
        reservation.locationId,
        reservation.lotId,
        -reservation.quantity,
        reservation.physicalQuantity,
        reservation.physicalQuantity - reservation.quantity,
        reservation.reservedQuantity,
        reservation.reservedQuantity - reservation.quantity,
        options.actorUserId,
        reservation.locationName,
      ],
    );
    if (inserted.rowCount === 0) {
      await executor.query(
        `UPDATE inventory_reservations SET status = 'CONSUMED', updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [options.organizationId, reservation.id],
      );
      continue;
    }
    await executor.query(
      `UPDATE inventory_balances
          SET physical_quantity = physical_quantity - $3,
              reserved_quantity = reserved_quantity - $3, updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, reservation.balanceId, reservation.quantity],
    );
    await executor.query(
      `UPDATE inventory_reservations SET status = 'CONSUMED', updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, reservation.id],
    );
    await writeAudit(executor, {
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      action: "inventory.reservation.consume",
      entityType: "InventoryReservation",
      entityId: reservation.id,
      before: { status: "COMMITTED" },
      after: { status: "CONSUMED" },
      requestId: options.requestId,
    });
    consumed += 1;
  }
  return consumed;
}

