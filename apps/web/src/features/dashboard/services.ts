import { MockDashboardService } from "./services/mock-dashboard-service";
import type { DashboardService } from "./services/dashboard-service";

export const dashboardService: DashboardService = new MockDashboardService();
