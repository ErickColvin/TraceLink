import {
  dashboardOverviewSchema,
  type DashboardAlert as ApiDashboardAlert,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  type HttpClient,
} from "@/lib/http/http-client";

import type { DashboardAlert, DashboardOverview } from "../domain";
import type { DashboardService } from "./dashboard-service";

function addAlertHref(alert: ApiDashboardAlert): DashboardAlert {
  switch (alert.type) {
    case "CRITICAL_STOCK":
      return {
        ...alert,
        href: `/app/inventory?status=${alert.availableStock === 0 ? "OUT" : "LOW"}`,
      };
    case "EXPIRING_BATCH":
      return { ...alert, href: "/app/inventory?expiry=EXPIRING" };
    case "PACKAGE_INCIDENT":
    case "PACKAGE_STORED_TOO_LONG":
      return {
        ...alert,
        href: `/app/packages/${encodePathSegment(alert.packageId)}`,
      };
    case "DELAYED_ORDER":
      return {
        ...alert,
        href: `/app/orders/${encodePathSegment(alert.orderId)}`,
      };
  }
}

export class HttpDashboardService implements DashboardService {
  constructor(private readonly client: HttpClient) {}

  async getOverview(): Promise<DashboardOverview> {
    const overview = await this.client.request("/staff/dashboard", {
      responseSchema: dashboardOverviewSchema,
    });

    return {
      ...overview,
      alerts: overview.alerts.map(addAlertHref),
    };
  }
}
