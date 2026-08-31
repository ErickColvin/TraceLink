import { tenantBrand } from "@/app/config/brand";
import type { InventoryItem } from "@/features/inventory/domain";
import type { InventoryService } from "@/features/inventory/services/inventory-service";
import type { OrderStatus, StaffOrder } from "@/features/orders/domain";
import type { StaffOrderService } from "@/features/orders/services/staff-order-service";
import type { PackageStatus, StaffPackage } from "@/features/packages/domain";
import type { StaffPackageService } from "@/features/packages/services/staff-package-service";
import { delay } from "@/lib/delay";

import type {
  DashboardAlert,
  DashboardOverview,
  DashboardTrendPoint,
} from "../domain";
import type { DashboardService } from "./dashboard-service";

const MAX_OPERATIONAL_RECORDS = 10_000;
const EXPIRING_SOON_DAYS = 14;

const PENDING_ORDER_STATUSES = new Set<OrderStatus>([
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY",
]);

const DELAYED_ORDER_STATUSES = new Set<OrderStatus>([
  "PAID",
  "PREPARING",
]);

const PACKAGE_ALERT_STATUSES = new Set<PackageStatus>(["INCIDENT", "LOST"]);

export type MockDashboardServiceDependencies = Readonly<{
  inventoryService: InventoryService;
  staffOrderService: StaffOrderService;
  staffPackageService: StaffPackageService;
}>;

export type MockDashboardServiceOptions = Readonly<{
  latencyMs?: number;
  now?: () => Date;
}>;

function calendarDateKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: tenantBrand.timezone,
    year: "numeric",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("No se pudo determinar la fecha operacional.");
  }

  return `${year}-${month}-${day}`;
}

function addCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildTrend(
  orders: readonly StaffOrder[],
  currentDateKey: string,
): DashboardTrendPoint[] {
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(currentDateKey, index - 6);
    const ordersForDay = orders.filter(
      (order) => calendarDateKey(order.createdAt) === date,
    );
    const confirmedOrders = ordersForDay.filter(
      (order) => order.paymentStatus === "PAID",
    );

    return {
      date,
      salesClp: confirmedOrders.reduce(
        (total, order) => total + order.total,
        0,
      ),
      orders: ordersForDay.filter(
        (order) => order.status !== "CANCELLED" && order.status !== "REFUNDED",
      ).length,
    };
  });

  return points.some((point) => point.orders > 0 || point.salesClp > 0)
    ? points
    : [];
}

function isExpiringSoon(
  item: InventoryItem,
  currentDateKey: string,
): boolean {
  if (!item.expiresAt || item.status === "EXPIRED") return false;

  const expiryDateKey = calendarDateKey(item.expiresAt);
  return (
    expiryDateKey >= currentDateKey &&
    expiryDateKey <= addCalendarDays(currentDateKey, EXPIRING_SOON_DAYS)
  );
}

function buildInventoryAlerts(
  criticalItems: readonly InventoryItem[],
  expiringItems: readonly InventoryItem[],
): DashboardAlert[] {
  const stockAlerts: DashboardAlert[] = criticalItems.map((item) => ({
    id: `dashboard-stock-${item.id}`,
    type: "CRITICAL_STOCK",
    severity: item.status === "OUT" ? "CRITICAL" : "WARNING",
    title:
      item.status === "OUT" ? "Producto sin stock disponible" : "Stock bajo mínimo",
    message: `${item.productName} (${item.sku}) requiere reposición.`,
    occurredAt: item.updatedAt,
    href: `/app/inventory?status=${item.status}`,
    inventoryItemId: item.id,
    sku: item.sku,
    availableStock: item.availableStock,
    minimumStock: item.minimumStock,
  }));
  const expiryAlerts: DashboardAlert[] = expiringItems.map((item) => ({
    id: `dashboard-expiry-${item.id}`,
    type: "EXPIRING_BATCH",
    severity: "WARNING",
    title: "Lote próximo a vencer",
    message: `${item.productName} requiere revisión de vencimiento.`,
    occurredAt: item.updatedAt,
    href: "/app/inventory?expiry=EXPIRING",
    inventoryItemId: item.id,
    batch: item.batch ?? "Sin lote registrado",
    expiresAt: item.expiresAt ?? item.updatedAt,
  }));

  return [...stockAlerts, ...expiryAlerts];
}

function buildPackageAlerts(packages: readonly StaffPackage[]): DashboardAlert[] {
  return packages
    .filter((customerPackage) => PACKAGE_ALERT_STATUSES.has(customerPackage.status))
    .map((customerPackage) => {
      const latestEvent = customerPackage.events.at(-1);

      return {
        id: `dashboard-package-${customerPackage.id}`,
        type: "PACKAGE_INCIDENT",
        severity: "CRITICAL",
        title:
          customerPackage.status === "LOST"
            ? "Paquete reportado como perdido"
            : "Paquete con incidencia",
        message:
          latestEvent?.description ??
          "El paquete requiere revisión del equipo operativo.",
        occurredAt: latestEvent?.occurredAt ?? customerPackage.updatedAt,
        href: `/app/packages?status=${customerPackage.status}&search=${encodeURIComponent(customerPackage.trackingCode)}`,
        packageId: customerPackage.id,
        trackingCode: customerPackage.trackingCode,
      } satisfies DashboardAlert;
    });
}

function buildDelayedOrderAlerts(
  orders: readonly StaffOrder[],
  currentTime: number,
): DashboardAlert[] {
  return orders
    .filter(
      (order) =>
        DELAYED_ORDER_STATUSES.has(order.status) &&
        order.estimatedReadyAt !== undefined &&
        Date.parse(order.estimatedReadyAt) < currentTime,
    )
    .map((order) => {
      const estimatedReadyAt = order.estimatedReadyAt;
      if (!estimatedReadyAt) {
        throw new Error("El pedido retrasado no tiene fecha estimada.");
      }

      const delayMinutes = Math.max(
        1,
        Math.floor((currentTime - Date.parse(estimatedReadyAt)) / 60_000),
      );

      return {
        id: `dashboard-order-${order.id}`,
        type: "DELAYED_ORDER",
        severity: "WARNING",
        title: "Pedido fuera del tiempo estimado",
        message: `${order.orderNumber} acumula ${delayMinutes} minutos de retraso.`,
        occurredAt: estimatedReadyAt,
        href: `/app/orders?status=${order.status}&query=${encodeURIComponent(order.orderNumber)}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
      } satisfies DashboardAlert;
    });
}

function sortAlerts(alerts: DashboardAlert[]): DashboardAlert[] {
  const severityPriority = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;

  return alerts.sort((left, right) => {
    const severityDifference =
      severityPriority[left.severity] - severityPriority[right.severity];
    return severityDifference !== 0
      ? severityDifference
      : Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  });
}

export class MockDashboardService implements DashboardService {
  private readonly latencyMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly dependencies: MockDashboardServiceDependencies,
    options: MockDashboardServiceOptions = {},
  ) {
    this.latencyMs = Math.max(0, options.latencyMs ?? 40);
    this.now = options.now ?? (() => new Date());
  }

  async getOverview(): Promise<DashboardOverview> {
    await delay(this.latencyMs);
    const [inventoryPage, orderPage, packagePage] = await Promise.all([
      this.dependencies.inventoryService.list({
        page: 1,
        pageSize: MAX_OPERATIONAL_RECORDS,
      }),
      this.dependencies.staffOrderService.list({
        page: 1,
        pageSize: MAX_OPERATIONAL_RECORDS,
        sort: "NEWEST",
      }),
      this.dependencies.staffPackageService.list({
        page: 1,
        pageSize: MAX_OPERATIONAL_RECORDS,
        sort: "NEWEST",
      }),
    ]);
    const now = this.now();
    const currentDateKey = calendarDateKey(now);
    const inventoryItems = inventoryPage.items;
    const orders = orderPage.items;
    const packages = packagePage.items;
    const criticalItems = inventoryItems.filter(
      (item) => item.status === "LOW" || item.status === "OUT",
    );
    const expiringItems = inventoryItems.filter((item) =>
      isExpiringSoon(item, currentDateKey),
    );
    const ordersToday = orders.filter(
      (order) => calendarDateKey(order.createdAt) === currentDateKey,
    );
    const alerts = sortAlerts([
      ...buildInventoryAlerts(criticalItems, expiringItems),
      ...buildPackageAlerts(packages),
      ...buildDelayedOrderAlerts(orders, now.getTime()),
    ]);

    return {
      kpis: {
        salesTodayClp: ordersToday
          .filter((order) => order.paymentStatus === "PAID")
          .reduce((total, order) => total + order.total, 0),
        ordersToday: ordersToday.length,
        pendingOrders: orders.filter((order) =>
          PENDING_ORDER_STATUSES.has(order.status),
        ).length,
        storedPackages: packages.filter(
          (customerPackage) => customerPackage.status === "STORED",
        ).length,
        criticalStockItems: criticalItems.length,
        expiringSoonItems: expiringItems.length,
      },
      salesTrend: buildTrend(orders, currentDateKey),
      alerts,
      generatedAt: now.toISOString(),
    };
  }
}
