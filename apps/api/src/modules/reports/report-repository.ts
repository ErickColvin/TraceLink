import type {
  OperationalReport,
  OperationalReportRecord,
  ReportListParams,
} from "@tracelink/contracts";
import { operationalReportSchema } from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { AppError } from "../../shared/errors/app-error.js";

type ReportContextRow = Readonly<{
  timezone: string;
  currentDate: string;
}>;

type ReportRow = Readonly<{
  id: string;
  date: string;
  category: OperationalReportRecord["category"];
  status: OperationalReportRecord["status"];
  title: string;
  reference: string;
  quantity: number;
  amountClp: number | null;
}>;

export type ReportDateRange = Readonly<{
  from: string;
  to: string;
}>;

export const MAX_REPORT_RANGE_DAYS = 366;
const DEFAULT_REPORT_RANGE_DAYS = 30;
const MAX_REPORT_RECORDS = 500;
const DAY_MILLISECONDS = 86_400_000;

function reportValidation(field: string, message: string): AppError {
  return new AppError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message,
    fieldErrors: { [field]: [message] },
  });
}

function dateToMilliseconds(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number): string {
  const date = new Date(dateToMilliseconds(value));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveReportDateRange(
  params: ReportListParams,
  currentDate: string,
): ReportDateRange {
  const to = params.to ?? currentDate;
  const from = params.from ?? addDays(to, -(DEFAULT_REPORT_RANGE_DAYS - 1));

  if (from > to) {
    throw reportValidation(
      "from",
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }
  const inclusiveDays =
    Math.floor((dateToMilliseconds(to) - dateToMilliseconds(from)) /
      DAY_MILLISECONDS) + 1;
  if (inclusiveDays > MAX_REPORT_RANGE_DAYS) {
    throw reportValidation(
      "from",
      `El rango del reporte no puede superar ${MAX_REPORT_RANGE_DAYS} días.`,
    );
  }
  return { from, to };
}

function organizationNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró la organización solicitada.",
  });
}

function toRecord(row: ReportRow): OperationalReportRecord {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    status: row.status,
    title: row.title,
    reference: row.reference,
    quantity: row.quantity,
    ...(row.amountClp === null ? {} : { amountClp: row.amountClp }),
  };
}

export class PostgresReportRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  list(
    organizationId: string,
    params: ReportListParams,
  ): Promise<OperationalReport> {
    return this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      const context = await this.#getContext(executor, organizationId);
      const range = resolveReportDateRange(params, context.currentDate);
      const result = await executor.query<ReportRow>(
        `WITH report_records AS (
           SELECT ('report-sales-' || local_date::text) AS id,
                  local_date::text AS date,
                  'SALES'::text AS category,
                  'OK'::text AS status,
                  'Ventas confirmadas'::text AS title,
                  'Cierre diario'::text AS reference,
                  COUNT(*)::integer AS quantity,
                  SUM(total)::double precision AS "amountClp"
             FROM (
               SELECT (created_at AT TIME ZONE $2)::date AS local_date, total
                 FROM orders
                WHERE organization_id = $1 AND payment_status = 'PAID'
             ) paid_orders
            WHERE local_date BETWEEN $3::date AND $4::date
            GROUP BY local_date

           UNION ALL

           SELECT ('report-orders-' || status || '-' || local_date::text),
                  local_date::text,
                  'ORDERS',
                  CASE
                    WHEN status IN ('CANCELLED', 'REFUNDED') THEN 'CRITICAL'
                    WHEN status IN (
                      'PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY'
                    ) THEN 'ATTENTION'
                    ELSE 'OK'
                  END,
                  CASE status
                    WHEN 'PENDING_PAYMENT' THEN 'Pedidos pendientes de pago'
                    WHEN 'PAID' THEN 'Pedidos pagados'
                    WHEN 'PREPARING' THEN 'Pedidos en preparación'
                    WHEN 'READY' THEN 'Pedidos listos'
                    WHEN 'COMPLETED' THEN 'Pedidos completados'
                    WHEN 'CANCELLED' THEN 'Pedidos cancelados'
                    ELSE 'Pedidos reembolsados'
                  END,
                  status,
                  COUNT(*)::integer,
                  CASE WHEN status = 'COMPLETED'
                    THEN SUM(total)::double precision
                    ELSE NULL
                  END
             FROM (
               SELECT (created_at AT TIME ZONE $2)::date AS local_date,
                      status::text, total
                 FROM orders
                WHERE organization_id = $1
             ) daily_orders
            WHERE local_date BETWEEN $3::date AND $4::date
            GROUP BY local_date, status

           UNION ALL

           SELECT ('report-packages-' || status || '-' || local_date::text),
                  local_date::text,
                  'PACKAGES',
                  CASE
                    WHEN status IN ('INCIDENT', 'LOST') THEN 'CRITICAL'
                    WHEN status IN (
                      'EXPECTED', 'RECEIVED', 'STORED',
                      'READY_FOR_PICKUP', 'RETURNED'
                    ) THEN 'ATTENTION'
                    ELSE 'OK'
                  END,
                  CASE status
                    WHEN 'EXPECTED' THEN 'Paquetes esperados'
                    WHEN 'RECEIVED' THEN 'Paquetes recibidos'
                    WHEN 'STORED' THEN 'Paquetes almacenados'
                    WHEN 'READY_FOR_PICKUP' THEN 'Paquetes por retirar'
                    WHEN 'PICKED_UP' THEN 'Paquetes entregados'
                    WHEN 'RETURNED' THEN 'Paquetes devueltos'
                    WHEN 'LOST' THEN 'Paquetes perdidos'
                    ELSE 'Incidentes de paquete'
                  END,
                  status,
                  COUNT(*)::integer,
                  NULL::double precision
             FROM (
               SELECT (created_at AT TIME ZONE $2)::date AS local_date,
                      status::text
                 FROM packages
                WHERE organization_id = $1
             ) daily_packages
            WHERE local_date BETWEEN $3::date AND $4::date
            GROUP BY local_date, status

           UNION ALL

           SELECT ('report-inventory-movement-' || type || '-' ||
                   local_date::text),
                  local_date::text,
                  'INVENTORY',
                  CASE
                    WHEN type IN ('DAMAGE', 'EXPIRED') THEN 'CRITICAL'
                    WHEN type = 'ADJUSTMENT' THEN 'ATTENTION'
                    ELSE 'OK'
                  END,
                  CASE type
                    WHEN 'PURCHASE_RECEIPT' THEN 'Recepciones de compra'
                    WHEN 'SALE' THEN 'Salidas por venta'
                    WHEN 'ADJUSTMENT' THEN 'Ajustes de inventario'
                    WHEN 'RETURN' THEN 'Devoluciones recibidas'
                    WHEN 'DAMAGE' THEN 'Bajas por daño'
                    WHEN 'EXPIRED' THEN 'Bajas por vencimiento'
                    WHEN 'TRANSFER_IN' THEN 'Transferencias recibidas'
                    ELSE 'Transferencias despachadas'
                  END,
                  type,
                  SUM(ABS(quantity_delta))::double precision,
                  NULL::double precision
             FROM (
               SELECT (created_at AT TIME ZONE $2)::date AS local_date,
                      type::text, quantity_delta
                 FROM inventory_movements
                WHERE organization_id = $1
             ) daily_movements
            WHERE local_date BETWEEN $3::date AND $4::date
            GROUP BY local_date, type

           UNION ALL

           SELECT ('report-inventory-health-' || health.status || '-' || $7),
                  $7::date::text,
                  'INVENTORY',
                  CASE WHEN health.status IN ('OUT', 'EXPIRED')
                    THEN 'CRITICAL'
                    ELSE 'ATTENTION'
                  END,
                  CASE health.status
                    WHEN 'OUT' THEN 'Productos sin stock'
                    WHEN 'LOW' THEN 'Productos con stock bajo'
                    WHEN 'EXPIRING' THEN 'Lotes próximos a vencer'
                    ELSE 'Lotes vencidos'
                  END,
                  health.status,
                  COUNT(*)::integer,
                  NULL::double precision
             FROM (
               SELECT CASE
                 WHEN lot.expiration_date IS NOT NULL
                  AND lot.expiration_date <= $7::date THEN 'EXPIRED'
                 WHEN balance.physical_quantity = 0
                   OR balance.physical_quantity - balance.reserved_quantity = 0
                   THEN 'OUT'
                 WHEN lot.expiration_date IS NOT NULL
                  AND lot.expiration_date <= $7::date +
                      COALESCE(settings.expiration_warning_days, 30)
                   THEN 'EXPIRING'
                 WHEN balance.physical_quantity - balance.reserved_quantity <=
                      CASE WHEN product.minimum_stock > 0
                        THEN product.minimum_stock
                        ELSE COALESCE(settings.low_stock_threshold, 5)
                      END
                   THEN 'LOW'
                 ELSE 'OK'
               END AS status
                 FROM inventory_balances balance
                 JOIN products product
                   ON product.organization_id = balance.organization_id
                  AND product.id = balance.product_id
                 LEFT JOIN inventory_lots lot
                   ON lot.organization_id = balance.organization_id
                  AND lot.id = balance.lot_id
                 LEFT JOIN organization_settings settings
                   ON settings.organization_id = balance.organization_id
                WHERE balance.organization_id = $1
             ) health
            WHERE health.status <> 'OK'
              AND $7::date BETWEEN $3::date AND $4::date
            GROUP BY health.status
         )
         SELECT id, date, category, status, title, reference,
                quantity, "amountClp"
           FROM report_records
          WHERE ($5::text IS NULL OR category = $5::text)
            AND ($6::text IS NULL OR status = $6::text)
          ORDER BY date DESC, category ASC, status DESC, reference ASC, id ASC
          LIMIT $8`,
        [
          organizationId,
          context.timezone,
          range.from,
          range.to,
          params.category ?? null,
          params.status ?? null,
          context.currentDate,
          MAX_REPORT_RECORDS,
        ],
      );
      const items = result.rows.map(toRecord);
      return operationalReportSchema.parse({
        generatedAt: new Date().toISOString(),
        items,
        summary: {
          records: items.length,
          quantity: items.reduce((total, item) => total + item.quantity, 0),
          amountClp: items.reduce(
            (total, item) => total + (item.amountClp ?? 0),
            0,
          ),
          critical: items.filter((item) => item.status === "CRITICAL").length,
        },
      });
    });
  }

  async #getContext(
    executor: SqlExecutor,
    organizationId: string,
  ): Promise<ReportContextRow> {
    const result = await executor.query<ReportContextRow>(
      `SELECT timezone,
              (now() AT TIME ZONE timezone)::date::text AS "currentDate"
         FROM organizations
        WHERE id = $1 AND active
        LIMIT 1`,
      [organizationId],
    );
    const context = result.rows[0];
    if (context === undefined) throw organizationNotFound();
    return context;
  }
}
