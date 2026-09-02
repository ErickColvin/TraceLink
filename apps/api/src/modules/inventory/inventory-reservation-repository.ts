import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";

export const INVENTORY_RESERVATION_STATUSES = [
  "ACTIVE",
  "CONSUMED",
  "RELEASED",
  "EXPIRED",
] as const;

export type InventoryReservationStatus =
  (typeof INVENTORY_RESERVATION_STATUSES)[number];

export type InventoryReservationRecord = Readonly<{
  id: string;
  organizationId: string;
  orderId: string | null;
  productId: string;
  locationId: string;
  lotId: string | null;
  quantity: number;
  status: InventoryReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

type ReservationRow = Readonly<{
  id: string;
  organizationId: string;
  orderId: string | null;
  productId: string;
  locationId: string;
  lotId: string | null;
  quantity: number;
  status: InventoryReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

type BalanceRow = Readonly<{
  id: string;
  physicalQuantity: number;
  reservedQuantity: number;
  locationName: string;
  expirationDate: string | null;
}>;

function toRecord(row: ReservationRow): InventoryReservationRecord {
  return {
    ...row,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function reservationNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "INVENTORY_RESERVATION_NOT_FOUND",
    message: "La reserva de inventario no existe.",
  });
}

function invalidReservationState(status: InventoryReservationStatus): AppError {
  return new AppError({
    statusCode: 409,
    code: "INVALID_RESERVATION_STATE",
    message: `La reserva ya se encuentra en estado ${status}.`,
  });
}

const RESERVATION_SELECT = `
  SELECT id, organization_id AS "organizationId", order_id AS "orderId",
         product_id AS "productId", location_id AS "locationId",
         lot_id AS "lotId", quantity, status,
         expires_at AS "expiresAt", created_at AS "createdAt",
         updated_at AS "updatedAt"
    FROM inventory_reservations`;

export class PostgresInventoryReservationRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  create(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    orderId: string | null;
    productId: string;
    locationId: string;
    lotId: string | null;
    quantity: number;
    expiresAt: Date;
    requestId: string;
  }>): Promise<InventoryReservationRecord> {
    return this.#database.sqlTransaction(async (executor) => {
      if (options.orderId !== null) {
        const order = await executor.query(
          `SELECT 1 FROM orders WHERE organization_id = $1 AND id = $2`,
          [options.organizationId, options.orderId],
        );
        if (order.rowCount === 0) {
          throw new AppError({
            statusCode: 404,
            code: "ORDER_NOT_FOUND",
            message: "El pedido asociado no existe.",
          });
        }
      }

      const balance = await this.#lockBalance(executor, options);
      if (
        balance.expirationDate !== null &&
        balance.expirationDate < new Date().toISOString().slice(0, 10)
      ) {
        throw new AppError({
          statusCode: 409,
          code: "INVENTORY_LOT_EXPIRED",
          message: "No se puede reservar inventario de un lote vencido.",
        });
      }
      if (balance.physicalQuantity - balance.reservedQuantity < options.quantity) {
        throw new AppError({
          statusCode: 409,
          code: "INSUFFICIENT_STOCK",
          message: "No existe stock disponible suficiente para crear la reserva.",
        });
      }

      await executor.query(
        `UPDATE inventory_balances
            SET reserved_quantity = reserved_quantity + $3, updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [options.organizationId, balance.id, options.quantity],
      );
      const inserted = await executor.query<ReservationRow>(
        `INSERT INTO inventory_reservations
           (organization_id, order_id, product_id, location_id, lot_id,
            quantity, status, expires_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, now())
         RETURNING id, organization_id AS "organizationId", order_id AS "orderId",
                   product_id AS "productId", location_id AS "locationId",
                   lot_id AS "lotId", quantity, status,
                   expires_at AS "expiresAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [
          options.organizationId,
          options.orderId,
          options.productId,
          options.locationId,
          options.lotId,
          options.quantity,
          options.expiresAt,
        ],
      );
      const row = inserted.rows[0];
      if (row === undefined) throw new Error("Reservation insert returned no row.");
      const reservation = toRecord(row);
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "inventory.reservation.create",
        entityType: "InventoryReservation",
        entityId: reservation.id,
        after: reservation,
        requestId: options.requestId,
      });
      return reservation;
    });
  }

  consume(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    reservationId: string;
    requestId: string;
  }>): Promise<InventoryReservationRecord> {
    return this.#database.sqlTransaction(async (executor) => {
      const reservation = await this.#lockReservation(
        executor,
        options.organizationId,
        options.reservationId,
      );
      if (reservation.status !== "ACTIVE") {
        throw invalidReservationState(reservation.status);
      }
      if (reservation.expiresAt.getTime() <= Date.now()) {
        throw new AppError({
          statusCode: 409,
          code: "INVENTORY_RESERVATION_EXPIRED",
          message: "La reserva de inventario ya venció.",
        });
      }
      const balance = await this.#lockBalance(executor, reservation);
      if (
        balance.reservedQuantity < reservation.quantity ||
        balance.physicalQuantity < reservation.quantity
      ) {
        throw new AppError({
          statusCode: 409,
          code: "INVENTORY_INTEGRITY_CONFLICT",
          message: "Las cantidades reservadas no son consistentes.",
        });
      }
      const nextPhysical = balance.physicalQuantity - reservation.quantity;
      const nextReserved = balance.reservedQuantity - reservation.quantity;
      await executor.query(
        `UPDATE inventory_balances
            SET physical_quantity = $3, reserved_quantity = $4, updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [options.organizationId, balance.id, nextPhysical, nextReserved],
      );
      await executor.query(
        `INSERT INTO inventory_movements
           (organization_id, balance_id, product_id, location_id, lot_id, type,
            quantity_delta, previous_physical_quantity, new_physical_quantity,
            previous_reserved_quantity, new_reserved_quantity, actor_user_id,
            origin_location, destination_location, reason)
         VALUES ($1, $2, $3, $4, $5, 'SALE', $6, $7, $8, $9, $10, $11,
                 $12, 'Pedido', 'Consumo de reserva')`,
        [
          options.organizationId,
          balance.id,
          reservation.productId,
          reservation.locationId,
          reservation.lotId,
          -reservation.quantity,
          balance.physicalQuantity,
          nextPhysical,
          balance.reservedQuantity,
          nextReserved,
          options.actorUserId,
          balance.locationName,
        ],
      );
      const updated = await this.#setStatus(
        executor,
        options.organizationId,
        reservation.id,
        "CONSUMED",
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "inventory.reservation.consume",
        entityType: "InventoryReservation",
        entityId: updated.id,
        before: toRecord(reservation),
        after: updated,
        requestId: options.requestId,
      });
      return updated;
    });
  }

  release(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    reservationId: string;
    requestId: string;
  }>): Promise<InventoryReservationRecord> {
    return this.#database.sqlTransaction(async (executor) => {
      const reservation = await this.#lockReservation(
        executor,
        options.organizationId,
        options.reservationId,
      );
      if (reservation.status !== "ACTIVE") {
        throw invalidReservationState(reservation.status);
      }
      await this.#releaseQuantity(executor, reservation);
      const updated = await this.#setStatus(
        executor,
        options.organizationId,
        reservation.id,
        "RELEASED",
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "inventory.reservation.release",
        entityType: "InventoryReservation",
        entityId: updated.id,
        before: toRecord(reservation),
        after: updated,
        requestId: options.requestId,
      });
      return updated;
    });
  }

  expireDue(options: Readonly<{
    organizationId: string;
    requestId: string;
    limit?: number;
  }>): Promise<readonly InventoryReservationRecord[]> {
    return this.#database.sqlTransaction(async (executor) => {
      const due = await executor.query<ReservationRow>(
        `${RESERVATION_SELECT}
          WHERE organization_id = $1 AND status = 'ACTIVE' AND expires_at <= now()
          ORDER BY expires_at ASC, id ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [options.organizationId, options.limit ?? 100],
      );
      const expired: InventoryReservationRecord[] = [];
      for (const reservation of due.rows) {
        await this.#releaseQuantity(executor, reservation);
        const updated = await this.#setStatus(
          executor,
          options.organizationId,
          reservation.id,
          "EXPIRED",
        );
        await writeAudit(executor, {
          organizationId: options.organizationId,
          action: "inventory.reservation.expire",
          entityType: "InventoryReservation",
          entityId: updated.id,
          before: toRecord(reservation),
          after: updated,
          requestId: options.requestId,
        });
        expired.push(updated);
      }
      return expired;
    });
  }

  async #lockReservation(
    executor: SqlExecutor,
    organizationId: string,
    reservationId: string,
  ): Promise<ReservationRow> {
    const result = await executor.query<ReservationRow>(
      `${RESERVATION_SELECT}
        WHERE organization_id = $1 AND id = $2
        FOR UPDATE`,
      [organizationId, reservationId],
    );
    const reservation = result.rows[0];
    if (reservation === undefined) throw reservationNotFound();
    return reservation;
  }

  async #lockBalance(
    executor: SqlExecutor,
    key: Readonly<{
      organizationId: string;
      productId: string;
      locationId: string;
      lotId: string | null;
    }>,
  ): Promise<BalanceRow> {
    const result = await executor.query<BalanceRow>(
      `SELECT b.id, b.physical_quantity AS "physicalQuantity",
              b.reserved_quantity AS "reservedQuantity", l.name AS "locationName",
              lot.expiration_date::text AS "expirationDate"
         FROM inventory_balances b
         JOIN inventory_locations l
           ON l.organization_id = b.organization_id AND l.id = b.location_id
         LEFT JOIN inventory_lots lot
           ON lot.organization_id = b.organization_id AND lot.id = b.lot_id
        WHERE b.organization_id = $1 AND b.product_id = $2
          AND b.location_id = $3 AND b.lot_id IS NOT DISTINCT FROM $4::uuid
        FOR UPDATE OF b`,
      [key.organizationId, key.productId, key.locationId, key.lotId],
    );
    const balance = result.rows[0];
    if (balance === undefined) {
      throw new AppError({
        statusCode: 404,
        code: "INVENTORY_BALANCE_NOT_FOUND",
        message: "El saldo de inventario solicitado no existe.",
      });
    }
    return balance;
  }

  async #releaseQuantity(
    executor: SqlExecutor,
    reservation: ReservationRow,
  ): Promise<void> {
    const balance = await this.#lockBalance(executor, reservation);
    if (balance.reservedQuantity < reservation.quantity) {
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
      [reservation.organizationId, balance.id, reservation.quantity],
    );
  }

  async #setStatus(
    executor: SqlExecutor,
    organizationId: string,
    reservationId: string,
    status: Exclude<InventoryReservationStatus, "ACTIVE">,
  ): Promise<InventoryReservationRecord> {
    const result = await executor.query<ReservationRow>(
      `UPDATE inventory_reservations SET status = $3, updated_at = now()
        WHERE organization_id = $1 AND id = $2
        RETURNING id, organization_id AS "organizationId", order_id AS "orderId",
                  product_id AS "productId", location_id AS "locationId",
                  lot_id AS "lotId", quantity, status,
                  expires_at AS "expiresAt", created_at AS "createdAt",
                  updated_at AS "updatedAt"`,
      [organizationId, reservationId, status],
    );
    const row = result.rows[0];
    if (row === undefined) throw reservationNotFound();
    return toRecord(row);
  }
}
