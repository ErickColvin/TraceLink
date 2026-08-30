import { delay } from "@/lib/delay";

import { mockDashboardOverview } from "../data/mock-dashboard";
import type { DashboardOverview } from "../domain";
import type { DashboardService } from "./dashboard-service";

function cloneOverview(overview: DashboardOverview): DashboardOverview {
  return {
    ...overview,
    kpis: { ...overview.kpis },
    salesTrend: overview.salesTrend.map((point) => ({ ...point })),
    alerts: overview.alerts.map((alert) => ({ ...alert })),
  };
}

export class MockDashboardService implements DashboardService {
  async getOverview(): Promise<DashboardOverview> {
    await delay(150);
    return cloneOverview(mockDashboardOverview);
  }
}
