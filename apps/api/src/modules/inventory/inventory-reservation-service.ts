import type { PostgresDatabase } from "../../database/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  PostgresInventoryReservationRepository,
  type InventoryReservationRecord,
} from "./inventory-reservation-repository.js";

export class InventoryReservationService {
  readonly #repository: PostgresInventoryReservationRepository;

  constructor(database: PostgresDatabase) {
    this.#repository = new PostgresInventoryReservationRepository(database);
  }

  create(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    orderId?: string;
    productId: string;
    locationId: string;
    lotId?: string;
    quantity: number;
    expiresAt: Date;
    requestId: string;
  }>): Promise<InventoryReservationRecord> {
    if (!Number.isSafeInteger(options.quantity) || options.quantity <= 0) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "La cantidad de la reserva debe ser un entero positivo.",
        fieldErrors: { quantity: ["Debe ser un entero positivo."] },
      });
    }
    if (!Number.isFinite(options.expiresAt.getTime()) || options.expiresAt <= new Date()) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "La fecha de vencimiento debe estar en el futuro.",
        fieldErrors: { expiresAt: ["Debe estar en el futuro."] },
      });
    }
    return this.#repository.create({
      ...options,
      orderId: options.orderId ?? null,
      lotId: options.lotId ?? null,
    });
  }

  consume(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    reservationId: string;
    requestId: string;
  }>): Promise<InventoryReservationRecord> {
    return this.#repository.consume(options);
  }

  release(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    reservationId: string;
    requestId: string;
  }>): Promise<InventoryReservationRecord> {
    return this.#repository.release(options);
  }

  expireDue(options: Readonly<{
    organizationId: string;
    requestId: string;
    limit?: number;
  }>): Promise<readonly InventoryReservationRecord[]> {
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "El límite debe ser un entero positivo.",
      });
    }
    return this.#repository.expireDue(options);
  }
}
