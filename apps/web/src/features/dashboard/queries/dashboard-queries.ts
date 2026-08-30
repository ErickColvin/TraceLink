import { useQuery } from "@tanstack/react-query";

import { dashboardService } from "../services";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: () => [...dashboardKeys.all, "overview"] as const,
};

export function useDashboardOverview() {
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: () => dashboardService.getOverview(),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

export const useDashboard = useDashboardOverview;
