import type { DashboardOverview } from "../domain";

export interface DashboardService {
  getOverview(): Promise<DashboardOverview>;
}
