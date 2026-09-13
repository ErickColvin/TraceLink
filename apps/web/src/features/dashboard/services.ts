import { applicationServices } from "../service-composition";
import type { DashboardService } from "./services/dashboard-service";

export const dashboardService: DashboardService =
  applicationServices.dashboardService;
