import type {
  CurrentCustomerPackageListParams,
  CustomerPackage,
  DeliverPackageRequest,
  PackageCustomerOptionPage,
  PackagePage,
  PackageStatus,
  ReceivePackageRequest,
  StaffPackage,
  StaffPackageListParams,
  StaffPackagePage,
  TransitionPackageRequest,
} from "@tracelink/contracts";
import {
  customerPackageSchema,
  packagePageSchema,
  packageCustomerOptionPageSchema,
  staffPackagePageSchema,
  staffPackageSchema,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import {
  isPostgresUniqueViolation,
  postgresConstraint,
} from "../../shared/database/postgres-errors.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  paginationMetadata,
  resolvePagination,
} from "../../shared/pagination/pagination.js";
import {
  generatePickupCode,
  hashPickupCode,
  verifyPickupCode,
} from "./pickup-code.js";
import {
  canTransitionPackage,
  packageTransitionDescription,
} from "./package-workflow.js";

type PackageRow = Readonly<{
  id: string;
  trackingCode: string;
  customerId: string;
  orderId: string | null;
  status: PackageStatus;
  description: string | null;
  itemCount: number;
  requiresColdStorage: boolean;
  receivedAt: Date | null;
  pickupDeadline: Date | null;
  storageLocation: string | null;
  weightKg: string | null;
  createdAt: Date;
  updatedAt: Date;
  carrier: string;
  notes: string | null;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string | null;
  receiptReceivedBy: string | null;
  pickupCodeVerified: boolean | null;
  deliveredAt: Date | null;
  deliveredByFirstName: string | null;
  deliveredByLastName: string | null;
}>;

type TrackingEventRow = Readonly<{
  id: string;
  packageId: string;
  previousStatus: PackageStatus | null;
  newStatus: PackageStatus;
  description: string;
  location: string | null;
  notes: string | null;
  occurredAt: Date;
  actorUserId: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
}>;

type LockedPackageRow = Readonly<{
  id: string;
  status: PackageStatus;
  storageLocationId: string | null;
  pickupCodeHash: Buffer | null;
  pickupCodeConsumedAt: Date | null;
  pickupDeadline: Date | null;
}>;

type LocationRow = Readonly<{ id: string; name: string }>;
type IdRow = Readonly<{ id: string }>;
type CountRow = Readonly<{ total: number }>;
export type PackageCustomerOptionListParams = Readonly<{
  search?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}>;

type CustomerListRequest = Readonly<{
  type: "customer";
  organizationId: string;
  customerId: string;
  params: CurrentCustomerPackageListParams;
}>;

type StaffListRequest = Readonly<{
  type: "staff";
  organizationId: string;
  params: StaffPackageListParams;
}>;

const PACKAGE_SELECT = `
  p.id,
  p.tracking_code AS "trackingCode",
  p.customer_id AS "customerId",
  p.order_id AS "orderId",
  p.status,
  p.description,
  p.item_count AS "itemCount",
  p.requires_cold_storage AS "requiresColdStorage",
  p.received_at AS "receivedAt",
  p.pickup_deadline AS "pickupDeadline",
  location.name AS "storageLocation",
  p.weight_kg::text AS "weightKg",
  p.created_at AS "createdAt",
  p.updated_at AS "updatedAt",
  p.carrier,
  p.notes,
  customer.first_name AS "customerFirstName",
  customer.last_name AS "customerLastName",
  customer.email AS "customerEmail",
  customer.phone AS "customerPhone",
  receipt.received_by AS "receiptReceivedBy",
  receipt.pickup_code_verified AS "pickupCodeVerified",
  receipt.delivered_at AS "deliveredAt",
  deliverer.first_name AS "deliveredByFirstName",
  deliverer.last_name AS "deliveredByLastName"`;

const PACKAGE_FROM = `
  FROM packages p
  JOIN customers customer
    ON customer.organization_id = p.organization_id
   AND customer.id = p.customer_id
  LEFT JOIN inventory_locations location
    ON location.organization_id = p.organization_id
   AND location.id = p.storage_location_id
  LEFT JOIN package_pickup_receipts receipt
    ON receipt.organization_id = p.organization_id
   AND receipt.package_id = p.id
  LEFT JOIN users deliverer ON deliverer.id = receipt.delivered_by_user_id`;

const TRACKING_SELECT = `
  event.id,
  event.package_id AS "packageId",
  event.previous_status AS "previousStatus",
  event.new_status AS "newStatus",
  event.description,
  event.location,
  event.notes,
  event.occurred_at AS "occurredAt",
  event.actor_user_id AS "actorUserId",
  actor.first_name AS "actorFirstName",
  actor.last_name AS "actorLastName"`;

function optional<Value>(value: Value | null): Value | undefined {
  return value === null ? undefined : value;
}

function fullName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter((part) => part !== null).join(" ");
  return name === "" ? "Sistema TraceLink" : name;
}

function customerPackage(row: PackageRow, events: readonly TrackingEventRow[]): CustomerPackage {
  return customerPackageSchema.parse({
    id: row.id,
    trackingCode: row.trackingCode,
    customerId: row.customerId,
    orderId: optional(row.orderId),
    status: row.status,
    contents: {
      description: row.description ?? "Contenido no especificado",
      itemCount: row.itemCount,
      requiresColdStorage: row.requiresColdStorage,
    },
    receivedAt: row.receivedAt?.toISOString(),
    pickupDeadline: row.pickupDeadline?.toISOString(),
    storageLocation: optional(row.storageLocation),
    weightKg: row.weightKg === null ? undefined : Number(row.weightKg),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    events: events.map((event) => ({
      id: event.id,
      status: event.newStatus,
      occurredAt: event.occurredAt.toISOString(),
      description: event.description,
      location: optional(event.location),
      ...(event.actorUserId === null
        ? {}
        : { recordedBy: fullName(event.actorFirstName, event.actorLastName) }),
    })),
  });
}

function staffPackage(row: PackageRow, events: readonly TrackingEventRow[]): StaffPackage {
  const deliveredBy = fullName(
    row.deliveredByFirstName,
    row.deliveredByLastName,
  );
  return staffPackageSchema.parse({
    ...customerPackage(row, events),
    carrier: row.carrier,
    notes: optional(row.notes),
    customer: {
      id: row.customerId,
      fullName: fullName(row.customerFirstName, row.customerLastName),
      email: row.customerEmail,
      phone: optional(row.customerPhone),
    },
    ...(row.receiptReceivedBy === null || row.deliveredAt === null
      ? {}
      : {
          pickupReceipt: {
            receivedBy: row.receiptReceivedBy,
            pickupCodeVerified: row.pickupCodeVerified === true,
            deliveredAt: row.deliveredAt.toISOString(),
            deliveredBy,
          },
        }),
    events: events.map((event) => ({
      id: event.id,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      occurredAt: event.occurredAt.toISOString(),
      description: event.description,
      location: optional(event.location),
      actor: {
        id: event.actorUserId ?? event.id,
        name: fullName(event.actorFirstName, event.actorLastName),
      },
      notes: optional(event.notes),
    })),
  });
}

function addValue(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function packageNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró el paquete solicitado.",
  });
}

function invalidTransition(fromStatus: PackageStatus, toStatus: PackageStatus): AppError {
  return new AppError({
    statusCode: 409,
    code: "INVALID_STATE_TRANSITION",
    message: `No se puede cambiar un paquete de ${fromStatus} a ${toStatus}.`,
  });
}

function trackingConflict(error: unknown): AppError | null {
  if (!isPostgresUniqueViolation(error)) return null;
  const constraint = postgresConstraint(error) ?? "";
  if (!constraint.includes("tracking")) return null;
  return new AppError({
    statusCode: 409,
    code: "CONFLICT",
    message: "Ya existe un paquete con ese código de seguimiento.",
    fieldErrors: {
      trackingCode: ["Este código de seguimiento ya está en uso."],
    },
    cause: error,
  });
}

function eventsByPackage(
  rows: readonly TrackingEventRow[],
): ReadonlyMap<string, readonly TrackingEventRow[]> {
  const grouped = new Map<string, TrackingEventRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.packageId) ?? [];
    current.push(row);
    grouped.set(row.packageId, current);
  }
  return grouped;
}

export class PostgresPackageRepository {
  readonly #database: PostgresDatabase;
  readonly #pickupCodeSecret: string;

  constructor(database: PostgresDatabase, pickupCodeSecret: string) {
    this.#database = database;
    this.#pickupCodeSecret = pickupCodeSecret;
  }

  listCurrentCustomer(
    organizationId: string,
    customerId: string,
    params: CurrentCustomerPackageListParams,
  ): Promise<PackagePage> {
    return this.#list({ type: "customer", organizationId, customerId, params });
  }

  listStaff(
    organizationId: string,
    params: StaffPackageListParams,
  ): Promise<StaffPackagePage> {
    return this.#list({ type: "staff", organizationId, params });
  }

  #list(request: CustomerListRequest): Promise<PackagePage>;
  #list(request: StaffListRequest): Promise<StaffPackagePage>;
  async #list(
    request: CustomerListRequest | StaffListRequest,
  ): Promise<PackagePage | StaffPackagePage> {
    const pagination = resolvePagination(request.params, 12);
    const values: unknown[] = [request.organizationId];
    const conditions = ["p.organization_id = $1"];

    if (request.type === "customer") {
      conditions.push(`p.customer_id = ${addValue(values, request.customerId)}`);
      if (request.params.search !== undefined) {
        const marker = addValue(values, `%${request.params.search}%`);
        conditions.push(
          `(p.tracking_code ILIKE ${marker} OR COALESCE(p.description, '') ILIKE ${marker})`,
        );
      }
    } else {
      const params = request.params;
      if (params.search !== undefined) {
        const marker = addValue(values, `%${params.search}%`);
        conditions.push(
          `(p.tracking_code ILIKE ${marker} OR p.carrier ILIKE ${marker} OR ` +
            `COALESCE(p.description, '') ILIKE ${marker} OR customer.first_name ILIKE ${marker} OR ` +
            `customer.last_name ILIKE ${marker} OR customer.email ILIKE ${marker})`,
        );
      }
      if (params.tracking !== undefined) {
        conditions.push(`p.tracking_code ILIKE ${addValue(values, `%${params.tracking}%`)}`);
      }
      if (params.customer !== undefined) {
        const marker = addValue(values, `%${params.customer}%`);
        conditions.push(
          `(customer.first_name ILIKE ${marker} OR customer.last_name ILIKE ${marker} ` +
            `OR customer.email ILIKE ${marker})`,
        );
      }
      if (params.carrier !== undefined) {
        conditions.push(`p.carrier ILIKE ${addValue(values, `%${params.carrier}%`)}`);
      }
      if (params.location !== undefined) {
        const marker = addValue(values, `%${params.location}%`);
        conditions.push(
          `(location.name ILIKE ${marker} OR location.code ILIKE ${marker})`,
        );
      }
      if (params.coldStorage !== undefined) {
        conditions.push(
          `p.requires_cold_storage = ${addValue(values, params.coldStorage)}`,
        );
      }
    }

    if (request.params.statuses !== undefined && request.params.statuses.length > 0) {
      conditions.push(`p.status = ANY(${addValue(values, request.params.statuses)}::text[])`);
    }

    const orderBy = request.type === "customer"
      ? {
          NEWEST: "p.created_at DESC, p.id ASC",
          OLDEST: "p.created_at ASC, p.id ASC",
          STATUS: "p.status ASC, p.created_at DESC, p.id ASC",
        }[request.params.sort ?? "NEWEST"]
      : {
          QUEUE: `CASE p.status
            WHEN 'READY_FOR_PICKUP' THEN 0 WHEN 'INCIDENT' THEN 1
            WHEN 'RECEIVED' THEN 2 WHEN 'STORED' THEN 3 ELSE 4 END,
            p.created_at ASC, p.id ASC`,
          NEWEST: "p.created_at DESC, p.id ASC",
          OLDEST: "p.created_at ASC, p.id ASC",
          STATUS: "p.status ASC, p.created_at DESC, p.id ASC",
        }[request.params.sort ?? "QUEUE"];
    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const filterValues = [...values];
    const limitMarker = addValue(values, pagination.limit);
    const offsetMarker = addValue(values, pagination.offset);
    const [itemsResult, countResult] = await Promise.all([
      this.#database.query<PackageRow>(
        `SELECT ${PACKAGE_SELECT} ${PACKAGE_FROM} ${whereSql}
          ORDER BY ${orderBy} LIMIT ${limitMarker} OFFSET ${offsetMarker}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total ${PACKAGE_FROM} ${whereSql}`,
        filterValues,
      ),
    ]);
    const groupedEvents = await this.#loadEvents(
      this.#database,
      request.organizationId,
      itemsResult.rows.map((row) => row.id),
    );
    const totalItems = countResult.rows[0]?.total ?? 0;
    const metadata = paginationMetadata(pagination, totalItems);
    if (request.type === "customer") {
      return packagePageSchema.parse({
        items: itemsResult.rows.map((row) =>
          customerPackage(row, groupedEvents.get(row.id) ?? []),
        ),
        ...metadata,
      });
    }
    return staffPackagePageSchema.parse({
      items: itemsResult.rows.map((row) =>
        staffPackage(row, groupedEvents.get(row.id) ?? []),
      ),
      ...metadata,
    });
  }

  getCurrentCustomerById(
    organizationId: string,
    customerId: string,
    packageId: string,
  ): Promise<CustomerPackage> {
    return this.#getCustomerOne(this.#database, organizationId, customerId, packageId);
  }

  getStaffById(organizationId: string, packageId: string): Promise<StaffPackage> {
    return this.#getStaffOne(this.#database, organizationId, packageId);
  }

  async listCustomerOptions(
    organizationId: string,
    params: PackageCustomerOptionListParams,
  ): Promise<PackageCustomerOptionPage> {
    const pagination = resolvePagination(params, 20);
    const values: unknown[] = [organizationId];
    const conditions = ["organization_id = $1", "status = 'ACTIVE'"];
    if (params.search !== undefined) {
      const marker = addValue(values, `%${params.search}%`);
      conditions.push(
        `(first_name ILIKE ${marker} OR last_name ILIKE ${marker} OR email ILIKE ${marker})`,
      );
    }
    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const filterValues = [...values];
    const limitMarker = addValue(values, pagination.limit);
    const offsetMarker = addValue(values, pagination.offset);
    const [items, count] = await Promise.all([
      this.#database.query<Readonly<{ id: string; displayName: string; email: string }>>(
        `SELECT id, concat_ws(' ', first_name, last_name) AS "displayName", email
           FROM customers ${whereSql}
          ORDER BY first_name ASC, last_name ASC, id ASC
          LIMIT ${limitMarker} OFFSET ${offsetMarker}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total FROM customers ${whereSql}`,
        filterValues,
      ),
    ]);
    const totalItems = count.rows[0]?.total ?? 0;
    return packageCustomerOptionPageSchema.parse({
      items: items.rows,
      ...paginationMetadata(pagination, totalItems),
    });
  }

  async receive(
    executor: SqlExecutor,
    options: Readonly<{
      organizationId: string;
      actorUserId: string;
      input: ReceivePackageRequest;
      requestId: string;
    }>,
  ): Promise<StaffPackage> {
    try {
      const customer = await executor.query<IdRow>(
        `SELECT id FROM customers
          WHERE organization_id = $1 AND id = $2 AND status = 'ACTIVE'
          LIMIT 1`,
        [options.organizationId, options.input.customerId],
      );
      if (customer.rows[0] === undefined) {
        throw new AppError({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: "El cliente seleccionado no es válido para esta organización.",
          fieldErrors: { customerId: ["Selecciona un cliente activo."] },
        });
      }
      if (options.input.orderId !== undefined) {
        const order = await executor.query<IdRow>(
          `SELECT id FROM orders
            WHERE organization_id = $1 AND id = $2 AND customer_id = $3
            LIMIT 1`,
          [options.organizationId, options.input.orderId, options.input.customerId],
        );
        if (order.rows[0] === undefined) {
          throw new AppError({
            statusCode: 400,
            code: "VALIDATION_ERROR",
            message: "El pedido no pertenece al cliente seleccionado.",
            fieldErrors: { orderId: ["Selecciona un pedido válido del cliente."] },
          });
        }
      }
      const location = await this.#resolveLocation(
        executor,
        options.organizationId,
        options.input.storageLocation,
      );
      const receivedAt = options.input.receivedAt === undefined
        ? new Date()
        : new Date(options.input.receivedAt);
      const pickupDeadline = new Date(receivedAt.getTime() + 30 * 24 * 60 * 60 * 1_000);
      const inserted = await executor.query<IdRow>(
        `INSERT INTO packages
           (organization_id, customer_id, order_id, tracking_code, carrier,
            description, item_count, requires_cold_storage, weight_kg,
            storage_location_id, status, received_at, pickup_deadline,
            received_by_user_id, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 'RECEIVED', $11, $12, $13, $14, now())
         RETURNING id`,
        [
          options.organizationId,
          options.input.customerId,
          options.input.orderId ?? null,
          options.input.trackingCode.toUpperCase(),
          options.input.carrier,
          options.input.contents.description,
          options.input.contents.itemCount,
          options.input.contents.requiresColdStorage,
          options.input.weightKg ?? null,
          location.id,
          receivedAt,
          pickupDeadline,
          options.actorUserId,
          options.input.notes ?? null,
        ],
      );
      const packageId = inserted.rows[0]?.id;
      if (packageId === undefined) throw new Error("Package insert returned no id.");
      const pickupCodeHash = hashPickupCode(
        this.#pickupCodeSecret,
        options.organizationId,
        packageId,
        generatePickupCode(),
      );
      await executor.query(
        `UPDATE packages SET pickup_code_hash = $3
          WHERE organization_id = $1 AND id = $2`,
        [options.organizationId, packageId, pickupCodeHash],
      );
      await this.#insertEvent(executor, {
        organizationId: options.organizationId,
        packageId,
        previousStatus: null,
        newStatus: "RECEIVED",
        description: packageTransitionDescription("RECEIVED"),
        location: location.name,
        actorUserId: options.actorUserId,
        notes: options.input.notes,
        occurredAt: receivedAt,
      });
      const created = await this.#getStaffOne(
        executor,
        options.organizationId,
        packageId,
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "package.receive",
        entityType: "Package",
        entityId: packageId,
        after: created,
        requestId: options.requestId,
      });
      return created;
    } catch (error) {
      throw trackingConflict(error) ?? error;
    }
  }

  async transition(
    executor: SqlExecutor,
    options: Readonly<{
      organizationId: string;
      actorUserId: string;
      packageId: string;
      input: TransitionPackageRequest;
      requestId: string;
    }>,
  ): Promise<StaffPackage> {
    const locked = await this.#lockPackage(executor, options.organizationId, options.packageId);
    if (!canTransitionPackage(locked.status, options.input.toStatus)) {
      throw invalidTransition(locked.status, options.input.toStatus);
    }
    if ((options.input.description?.length ?? 0) > 2_000) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "La descripción de trazabilidad es demasiado extensa.",
        fieldErrors: { description: ["Usa un máximo de 2000 caracteres."] },
      });
    }
    const before = await this.#getStaffOne(
      executor,
      options.organizationId,
      options.packageId,
    );
    const location = options.input.location === undefined
      ? null
      : await this.#resolveLocation(
          executor,
          options.organizationId,
          options.input.location,
        );
    const targetLocationId = location?.id ?? locked.storageLocationId;
    const transitionTime = new Date();
    let pickupCodeHash = locked.pickupCodeHash;
    let pickupDeadline = locked.pickupDeadline;
    if (options.input.toStatus === "RECEIVED" && pickupCodeHash === null) {
      pickupCodeHash = hashPickupCode(
        this.#pickupCodeSecret,
        options.organizationId,
        options.packageId,
        generatePickupCode(),
      );
      pickupDeadline = new Date(transitionTime.getTime() + 30 * 24 * 60 * 60 * 1_000);
    }
    await executor.query(
      `UPDATE packages
          SET status = $3,
              storage_location_id = $4,
              received_at = CASE WHEN $3 = 'RECEIVED' THEN COALESCE(received_at, $5) ELSE received_at END,
              stored_at = CASE WHEN $3 = 'STORED' THEN $5 ELSE stored_at END,
              ready_at = CASE WHEN $3 = 'READY_FOR_PICKUP' THEN $5 ELSE ready_at END,
              pickup_code_hash = $6,
              pickup_deadline = $7,
              received_by_user_id = CASE
                WHEN $3 = 'RECEIVED' THEN COALESCE(received_by_user_id, $8)
                ELSE received_by_user_id END,
              updated_at = $5
        WHERE organization_id = $1 AND id = $2`,
      [
        options.organizationId,
        options.packageId,
        options.input.toStatus,
        targetLocationId,
        transitionTime,
        pickupCodeHash,
        pickupDeadline,
        options.actorUserId,
      ],
    );
    await this.#insertEvent(executor, {
      organizationId: options.organizationId,
      packageId: options.packageId,
      previousStatus: locked.status,
      newStatus: options.input.toStatus,
      description:
        options.input.description ?? packageTransitionDescription(options.input.toStatus),
      location: location?.name ?? before.storageLocation,
      actorUserId: options.actorUserId,
      occurredAt: transitionTime,
    });
    const after = await this.#getStaffOne(
      executor,
      options.organizationId,
      options.packageId,
    );
    await writeAudit(executor, {
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      action: "package.transition",
      entityType: "Package",
      entityId: options.packageId,
      before,
      after,
      requestId: options.requestId,
    });
    return after;
  }

  async deliver(
    executor: SqlExecutor,
    options: Readonly<{
      organizationId: string;
      actorUserId: string;
      packageId: string;
      input: DeliverPackageRequest;
      requestId: string;
    }>,
  ): Promise<StaffPackage> {
    const locked = await this.#lockPackage(executor, options.organizationId, options.packageId);
    if (locked.status !== "READY_FOR_PICKUP") {
      throw invalidTransition(locked.status, "PICKED_UP");
    }
    const now = new Date();
    const credentialValid =
      locked.pickupCodeHash !== null &&
      locked.pickupCodeConsumedAt === null &&
      (locked.pickupDeadline === null || locked.pickupDeadline.getTime() >= now.getTime()) &&
      verifyPickupCode(
        this.#pickupCodeSecret,
        options.organizationId,
        options.packageId,
        options.input.pickupCode,
        locked.pickupCodeHash,
      );
    if (!credentialValid) {
      throw new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "No fue posible validar la entrega del paquete.",
      });
    }
    const before = await this.#getStaffOne(
      executor,
      options.organizationId,
      options.packageId,
    );
    await executor.query(
      `UPDATE packages
          SET status = 'PICKED_UP', picked_up_at = $3,
              pickup_code_consumed_at = $3, pickup_code_hash = NULL,
              updated_at = $3
        WHERE organization_id = $1 AND id = $2`,
      [options.organizationId, options.packageId, now],
    );
    await executor.query(
      `INSERT INTO package_pickup_receipts
         (organization_id, package_id, received_by, delivered_by_user_id,
          pickup_code_verified, delivered_at)
       VALUES ($1, $2, $3, $4, true, $5)`,
      [
        options.organizationId,
        options.packageId,
        options.input.receivedBy,
        options.actorUserId,
        now,
      ],
    );
    await this.#insertEvent(executor, {
      organizationId: options.organizationId,
      packageId: options.packageId,
      previousStatus: "READY_FOR_PICKUP",
      newStatus: "PICKED_UP",
      description: packageTransitionDescription("PICKED_UP"),
      location: before.storageLocation,
      actorUserId: options.actorUserId,
      notes: `Recibido por ${options.input.receivedBy}`,
      occurredAt: now,
    });
    const after = await this.#getStaffOne(
      executor,
      options.organizationId,
      options.packageId,
    );
    await writeAudit(executor, {
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      action: "package.deliver",
      entityType: "Package",
      entityId: options.packageId,
      before,
      after,
      requestId: options.requestId,
    });
    return after;
  }

  async #getCustomerOne(
    executor: SqlExecutor,
    organizationId: string,
    customerId: string,
    packageId: string,
  ): Promise<CustomerPackage> {
    const result = await executor.query<PackageRow>(
      `SELECT ${PACKAGE_SELECT} ${PACKAGE_FROM}
        WHERE p.organization_id = $1 AND p.customer_id = $2 AND p.id = $3
        LIMIT 1`,
      [organizationId, customerId, packageId],
    );
    const row = result.rows[0];
    if (row === undefined) throw packageNotFound();
    const events = await this.#loadEvents(executor, organizationId, [packageId]);
    return customerPackage(row, events.get(packageId) ?? []);
  }

  async #getStaffOne(
    executor: SqlExecutor,
    organizationId: string,
    packageId: string,
  ): Promise<StaffPackage> {
    const result = await executor.query<PackageRow>(
      `SELECT ${PACKAGE_SELECT} ${PACKAGE_FROM}
        WHERE p.organization_id = $1 AND p.id = $2
        LIMIT 1`,
      [organizationId, packageId],
    );
    const row = result.rows[0];
    if (row === undefined) throw packageNotFound();
    const events = await this.#loadEvents(executor, organizationId, [packageId]);
    return staffPackage(row, events.get(packageId) ?? []);
  }

  async #loadEvents(
    executor: SqlExecutor,
    organizationId: string,
    packageIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly TrackingEventRow[]>> {
    if (packageIds.length === 0) return new Map();
    const result = await executor.query<TrackingEventRow>(
      `SELECT ${TRACKING_SELECT}
         FROM tracking_events event
         LEFT JOIN users actor ON actor.id = event.actor_user_id
        WHERE event.organization_id = $1
          AND event.package_id = ANY($2::uuid[])
        ORDER BY event.occurred_at ASC, event.id ASC`,
      [organizationId, packageIds],
    );
    return eventsByPackage(result.rows);
  }

  async #lockPackage(
    executor: SqlExecutor,
    organizationId: string,
    packageId: string,
  ): Promise<LockedPackageRow> {
    const result = await executor.query<LockedPackageRow>(
      `SELECT id, status, storage_location_id AS "storageLocationId",
              pickup_code_hash AS "pickupCodeHash",
              pickup_code_consumed_at AS "pickupCodeConsumedAt",
              pickup_deadline AS "pickupDeadline"
         FROM packages
        WHERE organization_id = $1 AND id = $2
        FOR UPDATE`,
      [organizationId, packageId],
    );
    const row = result.rows[0];
    if (row === undefined) throw packageNotFound();
    return row;
  }

  async #resolveLocation(
    executor: SqlExecutor,
    organizationId: string,
    location: string,
  ): Promise<LocationRow> {
    const result = await executor.query<LocationRow>(
      `SELECT id, name FROM inventory_locations
        WHERE organization_id = $1 AND active
          AND (lower(name) = lower($2) OR lower(code) = lower($2))
        LIMIT 1`,
      [organizationId, location],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "La ubicación seleccionada no pertenece a la organización.",
        fieldErrors: { storageLocation: ["Selecciona una ubicación activa."] },
      });
    }
    return row;
  }

  async #insertEvent(
    executor: SqlExecutor,
    input: Readonly<{
      organizationId: string;
      packageId: string;
      previousStatus: PackageStatus | null;
      newStatus: PackageStatus;
      description: string;
      location?: string | undefined;
      actorUserId: string;
      notes?: string | undefined;
      occurredAt: Date;
    }>,
  ): Promise<void> {
    await executor.query(
      `INSERT INTO tracking_events
         (organization_id, package_id, previous_status, new_status,
          description, location, actor_user_id, notes, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.organizationId,
        input.packageId,
        input.previousStatus,
        input.newStatus,
        input.description,
        input.location ?? null,
        input.actorUserId,
        input.notes ?? null,
        input.occurredAt,
      ],
    );
  }
}
