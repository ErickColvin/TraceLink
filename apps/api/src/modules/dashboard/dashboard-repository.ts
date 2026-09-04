import type {
  DashboardAlert,
  DashboardAlertSeverity,
  DashboardOverview,
  DashboardTrendPoint,
} from "@tracelink/contracts";
import { dashboardOverviewSchema } from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { AppError } from "../../shared/errors/app-error.js";

type DashboardContextRow = Readonly<{
  timezone: string;
  expirationWarningDays: number;
  packageAlertDays: number;
  generatedAt: Date;
  currentDate: string;
}>;

type KpiRow = Readonly<{
  salesTodayClp: number;
  ordersToday: number;
  pendingOrders: number;
  storedPackages: number;
  criticalStockItems: number;
  expiringSoonItems: number;
}>;

type TrendRow = Readonly<{
  date: string;
  salesClp: number;
  orders: number;
}>;

type StockAlertRow = Readonly<{
  inventoryItemId: string;
  sku: string;
  productName: string;
  availableStock: number;
  minimumStock: number;
  occurredAt: Date;
}>;

type ExpiringAlertRow = Readonly<{
  inventoryItemId: string;
  productName: string;
  batch: string;
  expiresAt: string;
  occurredAt: Date;
}>;

type PackageIncidentRow = Readonly<{
  packageId: string;
  trackingCode: string;
  status: "INCIDENT" | "LOST";
  description: string | null;
  occurredAt: Date;
}>;

type StoredPackageRow = Readonly<{
  packageId: string;
  trackingCode: string;
  storedSince: Date;
  daysStored: number;
}>;

type DelayedOrderRow = Readonly<{
  orderId: string;
  orderNumber: string;
  estimatedReadyAt: Date;
  delayMinutes: number;
}>;

const ALERT_LIMIT_PER_TYPE = 25;
const MAX_ALERTS = 100;
const EFFECTIVE_MINIMUM = `CASE
  WHEN product.minimum_stock > 0 THEN product.minimum_stock
  ELSE COALESCE(settings.low_stock_threshold, 5)
END`;
const IS_NOT_EXPIRED = `(
  lot.expiration_date IS NULL OR lot.expiration_date > $2::date
)`;
const IS_OUT = `(
  balance.physical_quantity = 0 OR
  balance.physical_quantity - balance.reserved_quantity = 0
)`;
const IS_EXPIRING = `(
  lot.expiration_date IS NOT NULL AND
  lot.expiration_date > $2::date AND
  lot.expiration_date <= $2::date + $3::integer
)`;
const IS_CRITICAL = `(
  ${IS_NOT_EXPIRED} AND (
    ${IS_OUT} OR (
      NOT ${IS_EXPIRING} AND
      balance.physical_quantity - balance.reserved_quantity <=
        ${EFFECTIVE_MINIMUM}
    )
  )
)`;
const INVENTORY_JOINS = `
  FROM inventory_balances balance
  JOIN products product
    ON product.organization_id = balance.organization_id
   AND product.id = balance.product_id
  LEFT JOIN inventory_lots lot
    ON lot.organization_id = balance.organization_id
   AND lot.id = balance.lot_id
  LEFT JOIN organization_settings settings
    ON settings.organization_id = balance.organization_id`;

function organizationNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró la organización solicitada.",
  });
}

function sortAlerts(alerts: DashboardAlert[]): DashboardAlert[] {
  const priority: Readonly<Record<DashboardAlertSeverity, number>> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
  };
  return alerts
    .sort((left, right) => {
      const severity = priority[left.severity] - priority[right.severity];
      return severity !== 0
        ? severity
        : Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    })
    .slice(0, MAX_ALERTS);
}

function toTrend(rows: readonly TrendRow[]): DashboardTrendPoint[] {
  const trend = rows.map((row) => ({ ...row }));
  return trend.some((point) => point.orders > 0 || point.salesClp > 0)
    ? trend
    : [];
}

function stockAlerts(rows: readonly StockAlertRow[]): DashboardAlert[] {
  return rows.map((row) => ({
    id: `dashboard-stock-${row.inventoryItemId}`,
    type: "CRITICAL_STOCK",
    severity: row.availableStock === 0 ? "CRITICAL" : "WARNING",
    title:
      row.availableStock === 0
        ? "Producto sin stock disponible"
        : "Stock bajo mínimo",
    message: `${row.productName} (${row.sku}) requiere reposición.`,
    occurredAt: row.occurredAt.toISOString(),
    inventoryItemId: row.inventoryItemId,
    sku: row.sku,
    availableStock: row.availableStock,
    minimumStock: row.minimumStock,
  }));
}

function expiryAlerts(rows: readonly ExpiringAlertRow[]): DashboardAlert[] {
  return rows.map((row) => ({
    id: `dashboard-expiry-${row.inventoryItemId}`,
    type: "EXPIRING_BATCH",
    severity: "WARNING",
    title: "Lote próximo a vencer",
    message: `${row.productName} requiere revisión de vencimiento.`,
    occurredAt: row.occurredAt.toISOString(),
    inventoryItemId: row.inventoryItemId,
    batch: row.batch,
    expiresAt: row.expiresAt,
  }));
}

function incidentAlerts(rows: readonly PackageIncidentRow[]): DashboardAlert[] {
  return rows.map((row) => ({
    id: `dashboard-package-${row.packageId}`,
    type: "PACKAGE_INCIDENT",
    severity: "CRITICAL",
    title:
      row.status === "LOST"
        ? "Paquete reportado como perdido"
        : "Paquete con incidencia",
    message:
      row.description ??
      "El paquete requiere revisión del equipo operativo.",
    occurredAt: row.occurredAt.toISOString(),
    packageId: row.packageId,
    trackingCode: row.trackingCode,
  }));
}

function storageAlerts(rows: readonly StoredPackageRow[]): DashboardAlert[] {
  return rows.map((row) => ({
    id: `dashboard-package-storage-${row.packageId}`,
    type: "PACKAGE_STORED_TOO_LONG",
    severity: "WARNING",
    title: "Paquete almacenado por demasiado tiempo",
    message: `${row.trackingCode} lleva ${row.daysStored} días en custodia.`,
    occurredAt: row.storedSince.toISOString(),
    packageId: row.packageId,
    trackingCode: row.trackingCode,
    storedSince: row.storedSince.toISOString(),
    daysStored: row.daysStored,
  }));
}

function delayedOrderAlerts(
  rows: readonly DelayedOrderRow[],
): DashboardAlert[] {
  return rows.map((row) => ({
    id: `dashboard-order-${row.orderId}`,
    type: "DELAYED_ORDER",
    severity: "WARNING",
    title: "Pedido fuera del tiempo estimado",
    message: `${row.orderNumber} acumula ${row.delayMinutes} minutos de retraso.`,
    occurredAt: row.estimatedReadyAt.toISOString(),
    orderId: row.orderId,
    orderNumber: row.orderNumber,
  }));
}

export class PostgresDashboardRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  getOverview(organizationId: string): Promise<DashboardOverview> {
    return this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      const context = await this.#getContext(executor, organizationId);
      const queryArguments = [
        organizationId,
        context.currentDate,
        context.expirationWarningDays,
      ] as const;

      const kpis = await this.#getKpis(executor, queryArguments);
      const trend = await this.#getTrend(executor, {
        organizationId,
        timezone: context.timezone,
        currentDate: context.currentDate,
      });
      const stock = await this.#getStockAlerts(executor, queryArguments);
      const expiring = await this.#getExpiryAlerts(executor, queryArguments);
      const incidents = await this.#getPackageIncidentAlerts(
        executor,
        organizationId,
      );
      const stored = await this.#getStoredPackageAlerts(executor, {
        organizationId,
        packageAlertDays: context.packageAlertDays,
      });
      const delayed = await this.#getDelayedOrderAlerts(
        executor,
        organizationId,
      );

      return dashboardOverviewSchema.parse({
        kpis,
        salesTrend: toTrend(trend),
        alerts: sortAlerts([
          ...stockAlerts(stock),
          ...expiryAlerts(expiring),
          ...incidentAlerts(incidents),
          ...storageAlerts(stored),
          ...delayedOrderAlerts(delayed),
        ]),
        thresholds: {
          expirationWarningDays: context.expirationWarningDays,
          packageAlertDays: context.packageAlertDays,
        },
        generatedAt: context.generatedAt.toISOString(),
      });
    });
  }

  async #getContext(
    executor: SqlExecutor,
    organizationId: string,
  ): Promise<DashboardContextRow> {
    const result = await executor.query<DashboardContextRow>(
      `SELECT organization.timezone,
              GREATEST(
                COALESCE(settings.expiration_warning_days, 30),
                1
              )::integer AS "expirationWarningDays",
              GREATEST(
                COALESCE(settings.package_alert_days, 5),
                1
              )::integer AS "packageAlertDays",
              now() AS "generatedAt",
              (now() AT TIME ZONE organization.timezone)::date::text
                AS "currentDate"
         FROM organizations organization
         LEFT JOIN organization_settings settings
           ON settings.organization_id = organization.id
        WHERE organization.id = $1 AND organization.active
        LIMIT 1`,
      [organizationId],
    );
    const context = result.rows[0];
    if (context === undefined) throw organizationNotFound();
    return context;
  }

  async #getKpis(
    executor: SqlExecutor,
    args: readonly [string, string, number],
  ): Promise<KpiRow> {
    const result = await executor.query<KpiRow>(
      `SELECT
         COALESCE((
           SELECT SUM(total)
             FROM orders
            WHERE organization_id = $1
              AND payment_status = 'PAID'
              AND (created_at AT TIME ZONE organization.timezone)::date = $2::date
         ), 0)::double precision AS "salesTodayClp",
         (SELECT COUNT(*) FROM orders
           WHERE organization_id = $1
             AND (created_at AT TIME ZONE organization.timezone)::date = $2::date
         )::integer AS "ordersToday",
         (SELECT COUNT(*) FROM orders
           WHERE organization_id = $1
             AND status IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY')
         )::integer AS "pendingOrders",
         (SELECT COUNT(*) FROM packages
           WHERE organization_id = $1 AND status = 'STORED'
         )::integer AS "storedPackages",
         (SELECT COUNT(*) ${INVENTORY_JOINS}
           WHERE balance.organization_id = $1 AND ${IS_CRITICAL}
         )::integer AS "criticalStockItems",
         (SELECT COUNT(*) ${INVENTORY_JOINS}
           WHERE balance.organization_id = $1 AND ${IS_EXPIRING}
         )::integer AS "expiringSoonItems"
       FROM organizations organization
       WHERE organization.id = $1`,
      args,
    );
    const row = result.rows[0];
    if (row === undefined) throw organizationNotFound();
    return row;
  }

  async #getTrend(
    executor: SqlExecutor,
    input: Readonly<{
      organizationId: string;
      timezone: string;
      currentDate: string;
    }>,
  ): Promise<TrendRow[]> {
    const result = await executor.query<TrendRow>(
      `WITH days AS (
         SELECT generate_series(
                  $3::date - 6,
                  $3::date,
                  interval '1 day'
                )::date AS day
       )
       SELECT days.day::text AS date,
              COALESCE(
                SUM(orders.total) FILTER (
                  WHERE orders.payment_status = 'PAID'
                ),
                0
              )::double precision AS "salesClp",
              COUNT(orders.id) FILTER (
                WHERE orders.status NOT IN ('CANCELLED', 'REFUNDED')
              )::integer AS orders
         FROM days
         LEFT JOIN orders
           ON orders.organization_id = $1
          AND (orders.created_at AT TIME ZONE $2)::date = days.day
        GROUP BY days.day
        ORDER BY days.day ASC`,
      [input.organizationId, input.timezone, input.currentDate],
    );
    return result.rows;
  }

  async #getStockAlerts(
    executor: SqlExecutor,
    args: readonly [string, string, number],
  ): Promise<StockAlertRow[]> {
    const result = await executor.query<StockAlertRow>(
      `SELECT balance.id AS "inventoryItemId", product.sku,
              product.name AS "productName",
              CASE
                WHEN lot.expiration_date IS NOT NULL
                 AND lot.expiration_date <= $2::date THEN 0
                ELSE balance.physical_quantity - balance.reserved_quantity
              END::integer AS "availableStock",
              (${EFFECTIVE_MINIMUM})::integer AS "minimumStock",
              balance.updated_at AS "occurredAt"
         ${INVENTORY_JOINS}
        WHERE balance.organization_id = $1 AND ${IS_CRITICAL}
        ORDER BY "availableStock" ASC, balance.updated_at DESC, balance.id ASC
        LIMIT ${ALERT_LIMIT_PER_TYPE}`,
      args,
    );
    return result.rows;
  }

  async #getExpiryAlerts(
    executor: SqlExecutor,
    args: readonly [string, string, number],
  ): Promise<ExpiringAlertRow[]> {
    const result = await executor.query<ExpiringAlertRow>(
      `SELECT balance.id AS "inventoryItemId",
              product.name AS "productName", lot.lot_number AS batch,
              lot.expiration_date::text AS "expiresAt",
              balance.updated_at AS "occurredAt"
         ${INVENTORY_JOINS}
        WHERE balance.organization_id = $1 AND ${IS_EXPIRING}
        ORDER BY lot.expiration_date ASC, balance.updated_at DESC,
                 balance.id ASC
        LIMIT ${ALERT_LIMIT_PER_TYPE}`,
      args,
    );
    return result.rows;
  }

  async #getPackageIncidentAlerts(
    executor: SqlExecutor,
    organizationId: string,
  ): Promise<PackageIncidentRow[]> {
    const result = await executor.query<PackageIncidentRow>(
      `SELECT package.id AS "packageId",
              package.tracking_code AS "trackingCode", package.status,
              latest.description,
              COALESCE(latest.occurred_at, package.updated_at) AS "occurredAt"
         FROM packages package
         LEFT JOIN LATERAL (
           SELECT event.description, event.occurred_at
             FROM tracking_events event
            WHERE event.organization_id = package.organization_id
              AND event.package_id = package.id
            ORDER BY event.occurred_at DESC, event.id DESC
            LIMIT 1
         ) latest ON true
        WHERE package.organization_id = $1
          AND package.status IN ('INCIDENT', 'LOST')
        ORDER BY "occurredAt" DESC, package.id ASC
        LIMIT ${ALERT_LIMIT_PER_TYPE}`,
      [organizationId],
    );
    return result.rows;
  }

  async #getStoredPackageAlerts(
    executor: SqlExecutor,
    input: Readonly<{
      organizationId: string;
      packageAlertDays: number;
    }>,
  ): Promise<StoredPackageRow[]> {
    const result = await executor.query<StoredPackageRow>(
      `SELECT stored."packageId", stored."trackingCode",
              stored."storedSince",
              FLOOR(
                EXTRACT(EPOCH FROM (now() - stored."storedSince")) / 86400
              )::integer AS "daysStored"
         FROM (
           SELECT package.id AS "packageId",
                  package.tracking_code AS "trackingCode",
                  COALESCE(
                    package.stored_at,
                    latest.occurred_at,
                    package.received_at,
                    package.created_at
                  ) AS "storedSince"
             FROM packages package
             LEFT JOIN LATERAL (
               SELECT event.occurred_at
                 FROM tracking_events event
                WHERE event.organization_id = package.organization_id
                  AND event.package_id = package.id
                  AND event.new_status = 'STORED'
                ORDER BY event.occurred_at DESC, event.id DESC
                LIMIT 1
             ) latest ON true
            WHERE package.organization_id = $1
              AND package.status = 'STORED'
         ) stored
        WHERE stored."storedSince" <=
              now() - make_interval(days => $2::integer)
        ORDER BY stored."storedSince" ASC, stored."packageId" ASC
        LIMIT ${ALERT_LIMIT_PER_TYPE}`,
      [input.organizationId, input.packageAlertDays],
    );
    return result.rows;
  }

  async #getDelayedOrderAlerts(
    executor: SqlExecutor,
    organizationId: string,
  ): Promise<DelayedOrderRow[]> {
    const result = await executor.query<DelayedOrderRow>(
      `SELECT id AS "orderId", order_number AS "orderNumber",
              estimated_ready_at AS "estimatedReadyAt",
              GREATEST(
                FLOOR(EXTRACT(EPOCH FROM (now() - estimated_ready_at)) / 60),
                1
              )::integer AS "delayMinutes"
         FROM orders
        WHERE organization_id = $1
          AND status IN ('PAID', 'PREPARING')
          AND estimated_ready_at IS NOT NULL
          AND estimated_ready_at < now()
        ORDER BY estimated_ready_at ASC, id ASC
        LIMIT ${ALERT_LIMIT_PER_TYPE}`,
      [organizationId],
    );
    return result.rows;
  }
}
