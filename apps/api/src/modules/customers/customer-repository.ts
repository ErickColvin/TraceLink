import type {
  Customer,
  CustomerActivityEvent,
  CustomerProfileInput,
  StaffCustomerDetail,
  StaffCustomerListParams,
  StaffCustomerPage,
  StaffCustomerUpdateInput,
} from "@tracelink/contracts";
import {
  customerActivityEventSchema,
  customerSchema,
  staffCustomerDetailSchema,
  staffCustomerPageSchema,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { isPostgresUniqueViolation } from "../../shared/database/postgres-errors.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  paginationMetadata,
  resolvePagination,
} from "../../shared/pagination/pagination.js";

type CustomerRow = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  taxId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  commune: string | null;
  city: string | null;
  region: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}>;

type CustomerSummaryRow = CustomerRow & Readonly<{
  orderCount: number;
  activePackageCount: number;
  lastActivityAt: Date;
}>;

type CustomerOrderRow = Readonly<{
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  updatedAt: Date;
}>;

type CustomerPackageRow = Readonly<{
  id: string;
  trackingCode: string;
  status: string;
  description: string | null;
  updatedAt: Date;
}>;

type ActivityRow = Readonly<{
  id: string;
  kind: string;
  occurredAt: Date;
  description: string;
  actor: string;
}>;

type CountRow = Readonly<{ total: number }>;

const CUSTOMER_COLUMNS = `
  c.id,
  c.first_name AS "firstName",
  c.last_name AS "lastName",
  c.email,
  c.phone,
  c.tax_id AS "taxId",
  c.address_line_1 AS "addressLine1",
  c.address_line_2 AS "addressLine2",
  c.commune,
  c.city,
  c.region,
  c.status,
  c.created_at AS "createdAt",
  c.updated_at AS "updatedAt"`;

function optional<Value>(value: Value | null): Value | undefined {
  return value === null ? undefined : value;
}

function toCustomer(row: CustomerRow): Customer {
  const hasAddress =
    row.addressLine1 !== null &&
    row.commune !== null &&
    row.city !== null &&
    row.region !== null;
  return customerSchema.parse({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: optional(row.phone),
    taxId: optional(row.taxId),
    ...(hasAddress
      ? {
          address: {
            line1: row.addressLine1,
            line2: optional(row.addressLine2),
            commune: row.commune,
            city: row.city,
            region: row.region,
          },
        }
      : {}),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  });
}

function notFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró el cliente solicitado.",
  });
}

function conflict(error: unknown): AppError | null {
  return isPostgresUniqueViolation(error)
    ? new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "Ya existe un cliente con ese correo electrónico.",
        fieldErrors: { email: ["Este correo ya está en uso."] },
        cause: error,
      })
    : null;
}

function addValue(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function profileValues(input: CustomerProfileInput | StaffCustomerUpdateInput): readonly unknown[] {
  return [
    input.firstName,
    input.lastName,
    input.email,
    input.email.toLowerCase(),
    input.phone ?? null,
    input.address?.line1 ?? null,
    input.address?.line2 ?? null,
    input.address?.commune ?? null,
    input.address?.city ?? null,
    input.address?.region ?? null,
  ];
}

export class PostgresCustomerRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  getCurrent(organizationId: string, customerId: string): Promise<Customer> {
    return this.#getCustomer(this.#database, organizationId, customerId);
  }

  async updateCurrent(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    input: CustomerProfileInput;
    requestId: string;
  }>): Promise<Customer> {
    try {
      return await this.#database.sqlTransaction(async (executor) => {
        const before = await this.#getCustomer(
          executor,
          options.organizationId,
          options.customerId,
        );
        await this.#updateProfile(executor, {
          organizationId: options.organizationId,
          customerId: options.customerId,
          input: options.input,
        });
        const after = await this.#getCustomer(
          executor,
          options.organizationId,
          options.customerId,
        );
        await writeAudit(executor, {
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          action: "customer.profile.update",
          entityType: "Customer",
          entityId: options.customerId,
          before,
          after,
          requestId: options.requestId,
        });
        return after;
      });
    } catch (error) {
      throw conflict(error) ?? error;
    }
  }

  async listStaff(
    organizationId: string,
    params: StaffCustomerListParams,
  ): Promise<StaffCustomerPage> {
    const pagination = resolvePagination(params);
    const values: unknown[] = [organizationId];
    const conditions = ["c.organization_id = $1"];
    if (params.search !== undefined) {
      const marker = addValue(values, `%${params.search}%`);
      conditions.push(
        `(c.first_name ILIKE ${marker} OR c.last_name ILIKE ${marker} ` +
          `OR c.email ILIKE ${marker} OR COALESCE(c.phone, '') ILIKE ${marker})`,
      );
    }
    if (params.status !== undefined) {
      conditions.push(`c.status = ${addValue(values, params.status)}`);
    }
    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const orderBy = {
      NEWEST: "c.created_at DESC, c.id ASC",
      NAME_ASC: "c.first_name ASC, c.last_name ASC, c.id ASC",
      NAME_DESC: "c.first_name DESC, c.last_name DESC, c.id ASC",
    }[params.sort ?? "NEWEST"];
    const filterValues = [...values];
    const limit = addValue(values, pagination.limit);
    const offset = addValue(values, pagination.offset);
    const [items, count] = await Promise.all([
      this.#database.query<CustomerSummaryRow>(
        `SELECT ${CUSTOMER_COLUMNS},
                COUNT(DISTINCT o.id)::integer AS "orderCount",
                COUNT(DISTINCT p.id) FILTER (
                  WHERE p.status NOT IN ('PICKED_UP', 'RETURNED', 'LOST')
                )::integer AS "activePackageCount",
                GREATEST(
                  c.updated_at,
                  COALESCE(MAX(o.updated_at), c.updated_at),
                  COALESCE(MAX(p.updated_at), c.updated_at)
                ) AS "lastActivityAt"
           FROM customers c
           LEFT JOIN orders o
             ON o.organization_id = c.organization_id AND o.customer_id = c.id
           LEFT JOIN packages p
             ON p.organization_id = c.organization_id AND p.customer_id = c.id
          ${whereSql}
          GROUP BY c.id
          ORDER BY ${orderBy}
          LIMIT ${limit} OFFSET ${offset}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total FROM customers c ${whereSql}`,
        filterValues,
      ),
    ]);
    const totalItems = count.rows[0]?.total ?? 0;
    return staffCustomerPageSchema.parse({
      items: items.rows.map((row) => ({
        ...toCustomer(row),
        orderCount: row.orderCount,
        activePackageCount: row.activePackageCount,
        lastActivityAt: row.lastActivityAt.toISOString(),
      })),
      ...paginationMetadata(pagination, totalItems),
    });
  }

  async getStaffDetail(
    organizationId: string,
    customerId: string,
  ): Promise<StaffCustomerDetail> {
    const customer = await this.#getCustomer(
      this.#database,
      organizationId,
      customerId,
    );
    const [stats, orders, packages, activity] = await Promise.all([
      this.#database.query<Readonly<{
        orderCount: number;
        activePackageCount: number;
        lastActivityAt: Date;
      }>>(
        `SELECT COUNT(DISTINCT o.id)::integer AS "orderCount",
                COUNT(DISTINCT p.id) FILTER (
                  WHERE p.status NOT IN ('PICKED_UP', 'RETURNED', 'LOST')
                )::integer AS "activePackageCount",
                GREATEST(
                  c.updated_at,
                  COALESCE(MAX(o.updated_at), c.updated_at),
                  COALESCE(MAX(p.updated_at), c.updated_at)
                ) AS "lastActivityAt"
           FROM customers c
           LEFT JOIN orders o
             ON o.organization_id = c.organization_id AND o.customer_id = c.id
           LEFT JOIN packages p
             ON p.organization_id = c.organization_id AND p.customer_id = c.id
          WHERE c.organization_id = $1 AND c.id = $2
          GROUP BY c.id`,
        [organizationId, customerId],
      ),
      this.#database.query<CustomerOrderRow>(
        `SELECT id, order_number AS "orderNumber", status, total,
                updated_at AS "updatedAt"
           FROM orders
          WHERE organization_id = $1 AND customer_id = $2
          ORDER BY updated_at DESC, id ASC
          LIMIT 5`,
        [organizationId, customerId],
      ),
      this.#database.query<CustomerPackageRow>(
        `SELECT id, tracking_code AS "trackingCode", status, description,
                updated_at AS "updatedAt"
           FROM packages
          WHERE organization_id = $1 AND customer_id = $2
            AND status NOT IN ('PICKED_UP', 'RETURNED', 'LOST')
          ORDER BY updated_at DESC, id ASC
          LIMIT 5`,
        [organizationId, customerId],
      ),
      this.#listActivity(organizationId, customerId),
    ]);
    const summary = stats.rows[0];
    if (summary === undefined) throw notFound();
    return staffCustomerDetailSchema.parse({
      customer,
      orderCount: summary.orderCount,
      activePackageCount: summary.activePackageCount,
      lastActivityAt: summary.lastActivityAt.toISOString(),
      recentOrders: orders.rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        total: row.total,
        updatedAt: row.updatedAt.toISOString(),
      })),
      activePackages: packages.rows.map((row) => ({
        id: row.id,
        trackingCode: row.trackingCode,
        status: row.status,
        description: row.description ?? "Paquete sin descripción",
        updatedAt: row.updatedAt.toISOString(),
      })),
      activity,
    });
  }

  async updateStaff(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    input: StaffCustomerUpdateInput;
    requestId: string;
  }>): Promise<StaffCustomerDetail> {
    try {
      await this.#database.sqlTransaction(async (executor) => {
        const before = await this.#getCustomer(
          executor,
          options.organizationId,
          options.customerId,
        );
        await this.#updateProfile(executor, {
          organizationId: options.organizationId,
          customerId: options.customerId,
          input: options.input,
          status: options.input.status,
        });
        if (options.input.status === "INACTIVE") {
          await executor.query(
            `UPDATE sessions
                SET revoked_at = COALESCE(revoked_at, now()),
                    revocation_reason = COALESCE(revocation_reason, 'customer_disabled')
              WHERE organization_id = $1 AND customer_id = $2
                AND revoked_at IS NULL`,
            [options.organizationId, options.customerId],
          );
        }
        const after = await this.#getCustomer(
          executor,
          options.organizationId,
          options.customerId,
        );
        await writeAudit(executor, {
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          action: "customer.update",
          entityType: "Customer",
          entityId: options.customerId,
          before,
          after,
          requestId: options.requestId,
        });
      });
      return this.getStaffDetail(options.organizationId, options.customerId);
    } catch (error) {
      throw conflict(error) ?? error;
    }
  }

  async #getCustomer(
    executor: SqlExecutor,
    organizationId: string,
    customerId: string,
  ): Promise<Customer> {
    const result = await executor.query<CustomerRow>(
      `SELECT ${CUSTOMER_COLUMNS}
         FROM customers c
        WHERE c.organization_id = $1 AND c.id = $2
        LIMIT 1`,
      [organizationId, customerId],
    );
    const row = result.rows[0];
    if (row === undefined) throw notFound();
    return toCustomer(row);
  }

  async #updateProfile(
    executor: SqlExecutor,
    options: Readonly<{
      organizationId: string;
      customerId: string;
      input: CustomerProfileInput | StaffCustomerUpdateInput;
      status?: "ACTIVE" | "INACTIVE";
    }>,
  ): Promise<void> {
    await executor.query(
      `UPDATE customers
          SET first_name = $3, last_name = $4, email = $5,
              email_normalized = $6, phone = $7, address_line_1 = $8,
              address_line_2 = $9, commune = $10, city = $11, region = $12,
              status = COALESCE($13, status), updated_at = now()
        WHERE organization_id = $1 AND id = $2`,
      [
        options.organizationId,
        options.customerId,
        ...profileValues(options.input),
        options.status ?? null,
      ],
    );
  }

  async #listActivity(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerActivityEvent[]> {
    const result = await this.#database.query<ActivityRow>(
      `SELECT activity.id, activity.kind, activity."occurredAt",
              activity.description, activity.actor
         FROM (
           SELECT ('created-' || c.id::text) AS id,
                  'CUSTOMER_CREATED' AS kind,
                  c.created_at AS "occurredAt",
                  'Cliente creado' AS description,
                  'SYSTEM' AS actor
             FROM customers c
            WHERE c.organization_id = $1 AND c.id = $2
           UNION ALL
           SELECT a.id::text, 'PROFILE_UPDATED', a.created_at,
                  'Perfil de cliente actualizado',
                  CASE WHEN a.actor_user_id = c.user_id THEN 'CUSTOMER' ELSE 'STAFF' END
             FROM audit_logs a
             JOIN customers c
               ON c.organization_id = a.organization_id AND c.id = a.entity_id
            WHERE a.organization_id = $1 AND a.entity_type = 'Customer'
              AND a.entity_id = $2
           UNION ALL
           SELECT e.id::text, 'ORDER_UPDATED', e.occurred_at,
                  ('Pedido actualizado a ' || e.to_status),
                  CASE WHEN e.actor_user_id IS NULL THEN 'SYSTEM' ELSE 'STAFF' END
             FROM order_status_events e
             JOIN orders o
               ON o.organization_id = e.organization_id AND o.id = e.order_id
            WHERE e.organization_id = $1 AND o.customer_id = $2
           UNION ALL
           SELECT e.id::text, 'PACKAGE_UPDATED', e.occurred_at,
                  ('Paquete actualizado a ' || e.new_status),
                  CASE WHEN e.actor_user_id IS NULL THEN 'SYSTEM' ELSE 'STAFF' END
             FROM tracking_events e
             JOIN packages p
               ON p.organization_id = e.organization_id AND p.id = e.package_id
            WHERE e.organization_id = $1 AND p.customer_id = $2
         ) activity
        ORDER BY activity."occurredAt" DESC, activity.id ASC
        LIMIT 20`,
      [organizationId, customerId],
    );
    return result.rows.map((row) =>
      customerActivityEventSchema.parse({
        ...row,
        occurredAt: row.occurredAt.toISOString(),
      }),
    );
  }
}
