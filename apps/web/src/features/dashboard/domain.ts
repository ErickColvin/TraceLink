export type DashboardAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

interface DashboardAlertBase {
  id: string;
  severity: DashboardAlertSeverity;
  title: string;
  message: string;
  occurredAt: string;
  href?: string;
}

export type CriticalStockAlert = DashboardAlertBase & {
  type: "CRITICAL_STOCK";
  inventoryItemId: string;
  sku: string;
  availableStock: number;
  minimumStock: number;
};

export type ExpiringBatchAlert = DashboardAlertBase & {
  type: "EXPIRING_BATCH";
  inventoryItemId: string;
  batch: string;
  expiresAt: string;
};

export type PackageIncidentAlert = DashboardAlertBase & {
  type: "PACKAGE_INCIDENT";
  packageId: string;
  trackingCode: string;
};

export type DelayedOrderAlert = DashboardAlertBase & {
  type: "DELAYED_ORDER";
  orderId: string;
  orderNumber: string;
};

export type DashboardAlert =
  | CriticalStockAlert
  | ExpiringBatchAlert
  | PackageIncidentAlert
  | DelayedOrderAlert;

export interface DashboardKpis {
  salesTodayClp: number;
  ordersToday: number;
  pendingOrders: number;
  storedPackages: number;
  criticalStockItems: number;
  expiringSoonItems: number;
}

export interface DashboardTrendPoint {
  date: string;
  salesClp: number;
  orders: number;
}

export interface DashboardOverview {
  kpis: DashboardKpis;
  salesTrend: DashboardTrendPoint[];
  alerts: DashboardAlert[];
  generatedAt: string;
}
