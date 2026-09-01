import { z } from "zod";

import {
  clpAmountSchema,
  entityIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
} from "../common/index.js";

export const DASHBOARD_ALERT_SEVERITIES = [
  "INFO",
  "WARNING",
  "CRITICAL",
] as const;
export const dashboardAlertSeveritySchema = z.enum(
  DASHBOARD_ALERT_SEVERITIES,
);

const dashboardAlertBaseShape = {
  id: entityIdSchema,
  severity: dashboardAlertSeveritySchema,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2_000),
  occurredAt: isoDateTimeSchema,
} satisfies z.ZodRawShape;

export const criticalStockAlertSchema = z
  .object({
    ...dashboardAlertBaseShape,
    type: z.literal("CRITICAL_STOCK"),
    inventoryItemId: entityIdSchema,
    sku: z.string().trim().min(1).max(100),
    availableStock: nonNegativeIntegerSchema,
    minimumStock: nonNegativeIntegerSchema,
  })
  .strict();

export const expiringBatchAlertSchema = z
  .object({
    ...dashboardAlertBaseShape,
    type: z.literal("EXPIRING_BATCH"),
    inventoryItemId: entityIdSchema,
    batch: z.string().trim().min(1).max(120),
    expiresAt: isoDateSchema,
  })
  .strict();

export const packageIncidentAlertSchema = z
  .object({
    ...dashboardAlertBaseShape,
    type: z.literal("PACKAGE_INCIDENT"),
    packageId: entityIdSchema,
    trackingCode: z.string().trim().min(1).max(160),
  })
  .strict();

export const storedPackageAlertSchema = z
  .object({
    ...dashboardAlertBaseShape,
    type: z.literal("PACKAGE_STORED_TOO_LONG"),
    packageId: entityIdSchema,
    trackingCode: z.string().trim().min(1).max(160),
    storedSince: isoDateTimeSchema,
    daysStored: nonNegativeIntegerSchema,
  })
  .strict();

export const delayedOrderAlertSchema = z
  .object({
    ...dashboardAlertBaseShape,
    type: z.literal("DELAYED_ORDER"),
    orderId: entityIdSchema,
    orderNumber: z.string().trim().min(1).max(100),
  })
  .strict();

export const dashboardAlertSchema = z.discriminatedUnion("type", [
  criticalStockAlertSchema,
  expiringBatchAlertSchema,
  packageIncidentAlertSchema,
  storedPackageAlertSchema,
  delayedOrderAlertSchema,
]);

export const dashboardKpisSchema = z
  .object({
    salesTodayClp: clpAmountSchema,
    ordersToday: nonNegativeIntegerSchema,
    pendingOrders: nonNegativeIntegerSchema,
    storedPackages: nonNegativeIntegerSchema,
    criticalStockItems: nonNegativeIntegerSchema,
    expiringSoonItems: nonNegativeIntegerSchema,
  })
  .strict();

export const dashboardTrendPointSchema = z
  .object({
    date: isoDateSchema,
    salesClp: clpAmountSchema,
    orders: nonNegativeIntegerSchema,
  })
  .strict();

export const dashboardOverviewSchema = z
  .object({
    kpis: dashboardKpisSchema,
    salesTrend: z.array(dashboardTrendPointSchema),
    alerts: z.array(dashboardAlertSchema),
    thresholds: z
      .object({
        expirationWarningDays: positiveIntegerSchema,
        packageAlertDays: positiveIntegerSchema,
      })
      .strict(),
    generatedAt: isoDateTimeSchema,
  })
  .strict();

export type DashboardAlertSeverity = z.infer<
  typeof dashboardAlertSeveritySchema
>;
export type CriticalStockAlert = z.infer<typeof criticalStockAlertSchema>;
export type ExpiringBatchAlert = z.infer<typeof expiringBatchAlertSchema>;
export type PackageIncidentAlert = z.infer<typeof packageIncidentAlertSchema>;
export type StoredPackageAlert = z.infer<typeof storedPackageAlertSchema>;
export type DelayedOrderAlert = z.infer<typeof delayedOrderAlertSchema>;
export type DashboardAlert = z.infer<typeof dashboardAlertSchema>;
export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;
export type DashboardTrendPoint = z.infer<typeof dashboardTrendPointSchema>;
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
