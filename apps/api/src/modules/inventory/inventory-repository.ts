import type {
  CreateInventoryMovementRequest,
  InventoryCategory,
  InventoryItem,
  InventoryListParams,
  InventoryMovement,
  InventoryMovementListParams,
  InventoryMovementPage,
  InventoryPage,
  InventoryStatus,
} from "@tracelink/contracts";
import {
  inventoryCategorySchema,
  inventoryItemSchema,
  inventoryMovementPageSchema,
  inventoryMovementSchema,
  inventoryPageSchema,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  paginationMetadata,
  resolvePagination,
} from "../../shared/pagination/pagination.js";

type InventoryRow = Readonly<{
  organizationId: string;
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  productName: string;
  categoryId: string;
  categoryName: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  minimumStock: number;
  location: string;
  batch: string | null;
  expiresAt: string | null;
  status: InventoryStatus;
  updatedAt: Date;
}>;

type LockedBalanceRow = Readonly<{
  id: string;
  productId: string;
  locationId: string;
  lotId: string | null;
  physicalQuantity: number;
  reservedQuantity: number;
  locationName: string;
  lotNumber: string | null;
  expirationDate: string | null;
  sku: string;
  productName: string;
  minimumStock: number;
}>;

type MovementRow = Readonly<{
  id: string;
  inventoryItemId: string;
  productId: string;
  sku: string;
  productName: string;
  type: InventoryMovement["type"];
  quantityDelta: number;
  previousPhysicalQuantity: number;
  newPhysicalQuantity: number;
  previousReservedQuantity: number;
  newReservedQuantity: number;
  originLocation: string;
  destinationLocation: string | null;
  batch: string | null;
  expiresAt: string | null;
  minimumStock: number;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  createdBy: string;
}>;

type CountRow = Readonly<{ total: number }>;
type IdRow = Readonly<{ id: string }>;

const EFFECTIVE_MINIMUM = `CASE
  WHEN p.minimum_stock > 0 THEN p.minimum_stock
  ELSE COALESCE(s.low_stock_threshold, 5)
END`;
const AVAILABLE_QUANTITY = `b.physical_quantity - b.reserved_quantity`;
const INVENTORY_STATUS = `CASE
  WHEN lot.expiration_date IS NOT NULL AND lot.expiration_date <= CURRENT_DATE
    THEN 'EXPIRED'
  WHEN b.physical_quantity = 0 OR b.physical_quantity - b.reserved_quantity = 0
    THEN 'OUT'
  WHEN lot.expiration_date IS NOT NULL
   AND lot.expiration_date <= CURRENT_DATE + COALESCE(s.expiration_warning_days, 14)
    THEN 'EXPIRING'
  WHEN b.physical_quantity - b.reserved_quantity <= ${EFFECTIVE_MINIMUM}
    THEN 'LOW'
  ELSE 'OK'
END`;
const INVENTORY_SELECT = `
  SELECT b.id,
         b.organization_id AS "organizationId",
         b.product_id AS "productId",
         p.sku,
         p.barcode,
         p.name AS "productName",
         c.id AS "categoryId",
         c.name AS "categoryName",
         b.physical_quantity AS "physicalStock",
         b.reserved_quantity AS "reservedStock",
         (${AVAILABLE_QUANTITY})::integer AS "availableStock",
         (${EFFECTIVE_MINIMUM})::integer AS "minimumStock",
         l.name AS location,
         lot.lot_number AS batch,
         lot.expiration_date::text AS "expiresAt",
         (${INVENTORY_STATUS})::text AS status,
         b.updated_at AS "updatedAt"
    FROM inventory_balances b
    JOIN products p
      ON p.organization_id = b.organization_id AND p.id = b.product_id
    JOIN categories c
      ON c.organization_id = p.organization_id AND c.id = p.category_id
    JOIN inventory_locations l
      ON l.organization_id = b.organization_id AND l.id = b.location_id
    LEFT JOIN inventory_lots lot
      ON lot.organization_id = b.organization_id AND lot.id = b.lot_id
    LEFT JOIN organization_settings s ON s.organization_id = b.organization_id`;

function optional<Value>(value: Value | null): Value | undefined {
  return value === null ? undefined : value;
}

function toInventoryItem(row: InventoryRow): InventoryItem {
  return inventoryItemSchema.parse({
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    barcode: optional(row.barcode),
    productName: row.productName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    physicalStock: row.physicalStock,
    reservedStock: row.reservedStock,
    availableStock: row.availableStock,
    minimumStock: row.minimumStock,
    location: row.location,
    batch: optional(row.batch),
    expiresAt: optional(row.expiresAt),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  });
}

function deriveStatus(
  physical: number,
  reserved: number,
  minimum: number,
  expiresAt: string | null,
  warningDays = 14,
): InventoryStatus {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const expires = expiresAt === null ? undefined : new Date(`${expiresAt}T00:00:00.000Z`);
  if (expires !== undefined && expires.getTime() <= today.getTime()) return "EXPIRED";
  if (physical === 0 || physical - reserved === 0) return "OUT";
  if (
    expires !== undefined &&
    expires.getTime() <= today.getTime() + warningDays * 86_400_000
  ) {
    return "EXPIRING";
  }
  return physical - reserved <= minimum ? "LOW" : "OK";
}

function toMovement(row: MovementRow): InventoryMovement {
  const beforeAvailable = row.previousPhysicalQuantity - row.previousReservedQuantity;
  const afterAvailable = row.newPhysicalQuantity - row.newReservedQuantity;
  return inventoryMovementSchema.parse({
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    productId: row.productId,
    sku: row.sku,
    productName: row.productName,
    type: row.type,
    quantity: Math.abs(row.quantityDelta),
    quantityDelta: row.quantityDelta,
    before: {
      physicalStock: row.previousPhysicalQuantity,
      reservedStock: row.previousReservedQuantity,
      availableStock: beforeAvailable,
    },
    after: {
      physicalStock: row.newPhysicalQuantity,
      reservedStock: row.newReservedQuantity,
      availableStock: afterAvailable,
    },
    resultingStatus: deriveStatus(
      row.newPhysicalQuantity,
      row.newReservedQuantity,
      row.minimumStock,
      row.expiresAt,
    ),
    originLocation: row.originLocation,
    destinationLocation: optional(row.destinationLocation),
    batch: optional(row.batch),
    expiresAt: optional(row.expiresAt),
    reason: optional(row.reason),
    notes: optional(row.notes),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  });
}

function addValue(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function notFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró el registro de inventario solicitado.",
  });
}

function validation(field: string, message: string): AppError {
  return new AppError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message,
    fieldErrors: { [field]: [message] },
  });
}

function movementDelta(input: CreateInventoryMovementRequest): number {
  if (["PURCHASE_RECEIPT", "RETURN", "TRANSFER_IN"].includes(input.type)) {
    return input.quantity;
  }
  if (["SALE", "DAMAGE", "EXPIRED", "TRANSFER_OUT"].includes(input.type)) {
    return -input.quantity;
  }
  return input.adjustmentDirection === "INCREASE"
    ? input.quantity
    : -input.quantity;
}

function validateMovement(input: CreateInventoryMovementRequest): void {
  if (["ADJUSTMENT", "DAMAGE", "EXPIRED"].includes(input.type) && !input.reason) {
    throw validation("reason", "Debes indicar un motivo para este movimiento.");
  }
  if (input.type === "TRANSFER_IN" && !input.originLocation) {
    throw validation("originLocation", "Debes indicar la ubicación de origen.");
  }
  if (input.type === "TRANSFER_OUT" && !input.destinationLocation) {
    throw validation("destinationLocation", "Debes indicar la ubicación de destino.");
  }
}

function movementLocations(
  balance: LockedBalanceRow,
  input: CreateInventoryMovementRequest,
): Readonly<{ origin: string; destination: string | undefined }> {
  switch (input.type) {
    case "PURCHASE_RECEIPT":
      return { origin: input.originLocation ?? "Proveedor / recepción", destination: balance.locationName };
    case "RETURN":
      return { origin: input.originLocation ?? "Cliente / devolución", destination: balance.locationName };
    case "TRANSFER_IN":
      return { origin: input.originLocation ?? "Otra ubicación", destination: balance.locationName };
    case "SALE":
      return { origin: balance.locationName, destination: input.destinationLocation ?? "Cliente" };
    case "DAMAGE":
    case "EXPIRED":
      return { origin: balance.locationName, destination: input.destinationLocation ?? "Zona de cuarentena" };
    case "TRANSFER_OUT":
      return { origin: balance.locationName, destination: input.destinationLocation };
    case "ADJUSTMENT":
      return { origin: balance.locationName, destination: input.destinationLocation };
  }
}

export class PostgresInventoryRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  async list(
    organizationId: string,
    params: InventoryListParams,
  ): Promise<InventoryPage> {
    const pagination = resolvePagination(params);
    const values: unknown[] = [organizationId];
    const conditions = [`inventory."organizationId" = $1`];
    if (params.search !== undefined) {
      const marker = addValue(values, `%${params.search}%`);
      conditions.push(
        `(inventory."productName" ILIKE ${marker} OR inventory.sku ILIKE ${marker} ` +
          `OR COALESCE(inventory.barcode, '') ILIKE ${marker} ` +
          `OR COALESCE(inventory.batch, '') ILIKE ${marker} ` +
          `OR inventory.location ILIKE ${marker})`,
      );
    }
    if (params.categoryId !== undefined) {
      conditions.push(`inventory."categoryId" = ${addValue(values, params.categoryId)}`);
    }
    if (params.location !== undefined) {
      conditions.push(`inventory.location ILIKE ${addValue(values, `%${params.location}%`)}`);
    }
    if (params.statuses !== undefined && params.statuses.length > 0) {
      conditions.push(`inventory.status = ANY(${addValue(values, params.statuses)}::text[])`);
    }
    if (params.expiry === "WITH_EXPIRY") conditions.push(`inventory."expiresAt" IS NOT NULL`);
    if (params.expiry === "WITHOUT_EXPIRY") conditions.push(`inventory."expiresAt" IS NULL`);
    if (params.expiry === "EXPIRING") conditions.push(`inventory.status = 'EXPIRING'`);
    if (params.expiry === "EXPIRED") conditions.push(`inventory.status = 'EXPIRED'`);
    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const orderBy = {
      PRODUCT_ASC: `inventory."productName" ASC, inventory.id ASC`,
      AVAILABLE_ASC: `inventory."availableStock" ASC, inventory.id ASC`,
      AVAILABLE_DESC: `inventory."availableStock" DESC, inventory.id ASC`,
      EXPIRY_ASC: `inventory."expiresAt" ASC NULLS LAST, inventory.id ASC`,
      UPDATED_DESC: `inventory."updatedAt" DESC, inventory.id ASC`,
    }[params.sort ?? "PRODUCT_ASC"];
    const filterValues = [...values];
    const limit = addValue(values, pagination.limit);
    const offset = addValue(values, pagination.offset);
    const scopedSelect = INVENTORY_SELECT;
    const [items, count] = await Promise.all([
      this.#database.query<InventoryRow>(
        `SELECT inventory.* FROM (${scopedSelect}) inventory
          ${whereSql} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total FROM (${scopedSelect}) inventory ${whereSql}`,
        filterValues,
      ),
    ]);
    const totalItems = count.rows[0]?.total ?? 0;
    return inventoryPageSchema.parse({
      items: items.rows.map(toInventoryItem),
      ...paginationMetadata(pagination, totalItems),
    });
  }

  async listCategories(organizationId: string): Promise<InventoryCategory[]> {
    const result = await this.#database.query<Readonly<{ id: string; name: string }>>(
      `SELECT DISTINCT c.id, c.name
         FROM categories c
         JOIN products p
           ON p.organization_id = c.organization_id AND p.category_id = c.id
         JOIN inventory_balances b
           ON b.organization_id = p.organization_id AND b.product_id = p.id
        WHERE c.organization_id = $1
        ORDER BY c.name ASC, c.id ASC`,
      [organizationId],
    );
    return result.rows.map((row) => inventoryCategorySchema.parse(row));
  }

  async getById(organizationId: string, id: string): Promise<InventoryItem> {
    const result = await this.#database.query<InventoryRow>(
      `SELECT inventory.*
         FROM (${INVENTORY_SELECT}) inventory
        WHERE inventory."organizationId" = $1 AND inventory.id = $2
        LIMIT 1`,
      [organizationId, id],
    );
    const row = result.rows[0];
    if (row === undefined) throw notFound();
    return toInventoryItem(row);
  }

  async listMovements(
    organizationId: string,
    params: InventoryMovementListParams,
  ): Promise<InventoryMovementPage> {
    const pagination = resolvePagination(params);
    const values: unknown[] = [organizationId];
    const conditions = ["m.organization_id = $1"];
    if (params.inventoryItemId !== undefined) {
      conditions.push(`m.balance_id = ${addValue(values, params.inventoryItemId)}`);
    }
    if (params.types !== undefined && params.types.length > 0) {
      conditions.push(`m.type = ANY(${addValue(values, params.types)}::text[])`);
    }
    if (params.dateFrom !== undefined) {
      conditions.push(`m.created_at >= ${addValue(values, params.dateFrom)}::date`);
    }
    if (params.dateTo !== undefined) {
      conditions.push(`m.created_at < ${addValue(values, params.dateTo)}::date + interval '1 day'`);
    }
    if (params.search !== undefined) {
      const marker = addValue(values, `%${params.search}%`);
      conditions.push(
        `(p.name ILIKE ${marker} OR p.sku ILIKE ${marker} ` +
          `OR COALESCE(lot.lot_number, '') ILIKE ${marker} ` +
          `OR m.origin_location ILIKE ${marker} ` +
          `OR COALESCE(m.destination_location, '') ILIKE ${marker} ` +
          `OR COALESCE(m.reason, '') ILIKE ${marker} ` +
          `OR COALESCE(m.notes, '') ILIKE ${marker})`,
      );
    }
    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const filterValues = [...values];
    const limit = addValue(values, pagination.limit);
    const offset = addValue(values, pagination.offset);
    const fromSql = `
      FROM inventory_movements m
      JOIN products p
        ON p.organization_id = m.organization_id AND p.id = m.product_id
      JOIN users u ON u.id = m.actor_user_id
      LEFT JOIN inventory_lots lot
        ON lot.organization_id = m.organization_id AND lot.id = m.lot_id`;
    const [rows, count] = await Promise.all([
      this.#database.query<MovementRow>(
        `SELECT m.id, m.balance_id AS "inventoryItemId",
                m.product_id AS "productId", p.sku, p.name AS "productName",
                m.type, m.quantity_delta AS "quantityDelta",
                m.previous_physical_quantity AS "previousPhysicalQuantity",
                m.new_physical_quantity AS "newPhysicalQuantity",
                m.previous_reserved_quantity AS "previousReservedQuantity",
                m.new_reserved_quantity AS "newReservedQuantity",
                m.origin_location AS "originLocation",
                m.destination_location AS "destinationLocation",
                lot.lot_number AS batch, lot.expiration_date::text AS "expiresAt",
                p.minimum_stock AS "minimumStock", m.reason, m.notes,
                m.created_at AS "createdAt",
                concat_ws(' ', u.first_name, u.last_name) AS "createdBy"
           ${fromSql} ${whereSql}
          ORDER BY m.created_at DESC, m.id ASC
          LIMIT ${limit} OFFSET ${offset}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total ${fromSql} ${whereSql}`,
        filterValues,
      ),
    ]);
    const totalItems = count.rows[0]?.total ?? 0;
    return inventoryMovementPageSchema.parse({
      items: rows.rows.map(toMovement),
      ...paginationMetadata(pagination, totalItems),
    });
  }

  async createMovement(
    executor: SqlExecutor,
    options: Readonly<{
      organizationId: string;
      actorUserId: string;
      input: CreateInventoryMovementRequest;
      requestId: string;
    }>,
  ): Promise<InventoryMovement> {
    validateMovement(options.input);
    const balance = await this.#lockBalance(
      executor,
      options.organizationId,
      options.input.inventoryItemId,
    );
    const delta = movementDelta(options.input);
    const nextPhysical = balance.physicalQuantity + delta;
    const nextReserved = options.input.type === "SALE"
      ? Math.max(0, balance.reservedQuantity - options.input.quantity)
      : balance.reservedQuantity;
    if (nextPhysical < 0 || nextReserved > nextPhysical) {
      throw new AppError({
        statusCode: 409,
        code: "INSUFFICIENT_STOCK",
        message: "El movimiento dejaría cantidades de inventario inválidas.",
      });
    }
    const locations = movementLocations(balance, options.input);
    await executor.query(
      `UPDATE inventory_balances
          SET physical_quantity = $3, reserved_quantity = $4, updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, balance.id, nextPhysical, nextReserved],
    );
    const movement = await this.#insertMovement(executor, {
      organizationId: options.organizationId,
      balance,
      actorUserId: options.actorUserId,
      type: options.input.type,
      delta,
      previousPhysical: balance.physicalQuantity,
      newPhysical: nextPhysical,
      previousReserved: balance.reservedQuantity,
      newReserved: nextReserved,
      origin: locations.origin,
      destination: locations.destination,
      reason: options.input.reason,
      notes: options.input.notes,
    });

    if (options.input.type === "TRANSFER_OUT") {
      await this.#receiveTransfer(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        source: balance,
        destinationName: locations.destination ?? "",
        quantity: options.input.quantity,
        reason: options.input.reason,
        notes: options.input.notes,
      });
    }
    await writeAudit(executor, {
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      action: "inventory.movement.create",
      entityType: "InventoryMovement",
      entityId: movement.id,
      after: movement,
      requestId: options.requestId,
    });
    return movement;
  }

  async #lockBalance(
    executor: SqlExecutor,
    organizationId: string,
    balanceId: string,
  ): Promise<LockedBalanceRow> {
    const result = await executor.query<LockedBalanceRow>(
      `SELECT b.id, b.product_id AS "productId", b.location_id AS "locationId",
              b.lot_id AS "lotId", b.physical_quantity AS "physicalQuantity",
              b.reserved_quantity AS "reservedQuantity", l.name AS "locationName",
              lot.lot_number AS "lotNumber",
              lot.expiration_date::text AS "expirationDate", p.sku,
              p.name AS "productName", p.minimum_stock AS "minimumStock"
         FROM inventory_balances b
         JOIN products p
           ON p.organization_id = b.organization_id AND p.id = b.product_id
         JOIN inventory_locations l
           ON l.organization_id = b.organization_id AND l.id = b.location_id
         LEFT JOIN inventory_lots lot
           ON lot.organization_id = b.organization_id AND lot.id = b.lot_id
        WHERE b.organization_id = $1 AND b.id = $2
        FOR UPDATE OF b`,
      [organizationId, balanceId],
    );
    const row = result.rows[0];
    if (row === undefined) throw notFound();
    return row;
  }

  async #insertMovement(
    executor: SqlExecutor,
    input: Readonly<{
      organizationId: string;
      balance: LockedBalanceRow;
      actorUserId: string;
      type: InventoryMovement["type"];
      delta: number;
      previousPhysical: number;
      newPhysical: number;
      previousReserved: number;
      newReserved: number;
      origin: string;
      destination: string | undefined;
      reason: string | undefined;
      notes: string | undefined;
    }>,
  ): Promise<InventoryMovement> {
    const inserted = await executor.query<IdRow>(
      `INSERT INTO inventory_movements
         (organization_id, balance_id, product_id, location_id, lot_id, type,
          quantity_delta, previous_physical_quantity, new_physical_quantity,
          previous_reserved_quantity, new_reserved_quantity, actor_user_id,
          origin_location, destination_location, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               $13, $14, $15, $16)
       RETURNING id`,
      [
        input.organizationId,
        input.balance.id,
        input.balance.productId,
        input.balance.locationId,
        input.balance.lotId,
        input.type,
        input.delta,
        input.previousPhysical,
        input.newPhysical,
        input.previousReserved,
        input.newReserved,
        input.actorUserId,
        input.origin,
        input.destination ?? null,
        input.reason ?? null,
        input.notes ?? null,
      ],
    );
    const id = inserted.rows[0]?.id;
    if (id === undefined) throw new Error("Inventory movement insert returned no id.");
    return this.#getMovement(executor, input.organizationId, id);
  }

  async #getMovement(
    executor: SqlExecutor,
    organizationId: string,
    id: string,
  ): Promise<InventoryMovement> {
    const result = await executor.query<MovementRow>(
      `SELECT m.id, m.balance_id AS "inventoryItemId",
              m.product_id AS "productId", p.sku, p.name AS "productName",
              m.type, m.quantity_delta AS "quantityDelta",
              m.previous_physical_quantity AS "previousPhysicalQuantity",
              m.new_physical_quantity AS "newPhysicalQuantity",
              m.previous_reserved_quantity AS "previousReservedQuantity",
              m.new_reserved_quantity AS "newReservedQuantity",
              m.origin_location AS "originLocation",
              m.destination_location AS "destinationLocation",
              lot.lot_number AS batch, lot.expiration_date::text AS "expiresAt",
              p.minimum_stock AS "minimumStock", m.reason, m.notes,
              m.created_at AS "createdAt",
              concat_ws(' ', u.first_name, u.last_name) AS "createdBy"
         FROM inventory_movements m
         JOIN products p
           ON p.organization_id = m.organization_id AND p.id = m.product_id
         JOIN users u ON u.id = m.actor_user_id
         LEFT JOIN inventory_lots lot
           ON lot.organization_id = m.organization_id AND lot.id = m.lot_id
        WHERE m.organization_id = $1 AND m.id = $2`,
      [organizationId, id],
    );
    const row = result.rows[0];
    if (row === undefined) throw notFound();
    return toMovement(row);
  }

  async #receiveTransfer(
    executor: SqlExecutor,
    input: Readonly<{
      organizationId: string;
      actorUserId: string;
      source: LockedBalanceRow;
      destinationName: string;
      quantity: number;
      reason: string | undefined;
      notes: string | undefined;
    }>,
  ): Promise<void> {
    const location = await executor.query<Readonly<{ id: string; name: string }>>(
      `SELECT id, name FROM inventory_locations
        WHERE organization_id = $1 AND active
          AND (lower(name) = lower($2) OR lower(code) = lower($2))
        LIMIT 1`,
      [input.organizationId, input.destinationName],
    );
    const destination = location.rows[0];
    if (destination === undefined || destination.id === input.source.locationId) {
      throw validation(
        "destinationLocation",
        "Selecciona una ubicación de destino distinta y válida.",
      );
    }
    const conflictTarget = input.source.lotId === null
      ? `(organization_id, product_id, location_id) WHERE lot_id IS NULL`
      : `(organization_id, product_id, location_id, lot_id) WHERE lot_id IS NOT NULL`;
    await executor.query(
      `INSERT INTO inventory_balances
         (organization_id, product_id, location_id, lot_id,
          physical_quantity, reserved_quantity, updated_at)
       VALUES ($1, $2, $3, $4, 0, 0, now())
       ON CONFLICT ${conflictTarget} DO NOTHING`,
      [
        input.organizationId,
        input.source.productId,
        destination.id,
        input.source.lotId,
      ],
    );
    const targetResult = await executor.query<LockedBalanceRow>(
      `SELECT b.id, b.product_id AS "productId", b.location_id AS "locationId",
              b.lot_id AS "lotId", b.physical_quantity AS "physicalQuantity",
              b.reserved_quantity AS "reservedQuantity", l.name AS "locationName",
              lot.lot_number AS "lotNumber", lot.expiration_date::text AS "expirationDate",
              p.sku, p.name AS "productName", p.minimum_stock AS "minimumStock"
         FROM inventory_balances b
         JOIN products p
           ON p.organization_id = b.organization_id AND p.id = b.product_id
         JOIN inventory_locations l
           ON l.organization_id = b.organization_id AND l.id = b.location_id
         LEFT JOIN inventory_lots lot
           ON lot.organization_id = b.organization_id AND lot.id = b.lot_id
        WHERE b.organization_id = $1 AND b.product_id = $2
          AND b.location_id = $3 AND b.lot_id IS NOT DISTINCT FROM $4::uuid
        FOR UPDATE OF b`,
      [input.organizationId, input.source.productId, destination.id, input.source.lotId],
    );
    const target = targetResult.rows[0];
    if (target === undefined) throw new Error("Transfer target balance was not created.");
    const nextPhysical = target.physicalQuantity + input.quantity;
    await executor.query(
      `UPDATE inventory_balances SET physical_quantity = $3, updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [input.organizationId, target.id, nextPhysical],
    );
    await this.#insertMovement(executor, {
      organizationId: input.organizationId,
      balance: target,
      actorUserId: input.actorUserId,
      type: "TRANSFER_IN",
      delta: input.quantity,
      previousPhysical: target.physicalQuantity,
      newPhysical: nextPhysical,
      previousReserved: target.reservedQuantity,
      newReserved: target.reservedQuantity,
      origin: input.source.locationName,
      destination: destination.name,
      reason: input.reason,
      notes: input.notes,
    });
  }
}
