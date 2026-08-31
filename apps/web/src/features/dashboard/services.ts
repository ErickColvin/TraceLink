import { inventoryService } from "@/features/inventory/services";
import { staffOrderService } from "@/features/orders/services";
import { staffPackageService } from "@/features/packages/services";

import { MockDashboardService } from "./services/mock-dashboard-service";
import type { DashboardService } from "./services/dashboard-service";

export const dashboardService: DashboardService = new MockDashboardService({
  inventoryService,
  staffOrderService,
  staffPackageService,
});
