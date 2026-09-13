import { useQuery } from "@tanstack/react-query";

import type { ReportListParams } from "../domain";
import { reportService } from "../services";

export const reportKeys = {
  all: ["reports"] as const,
  list: (params: ReportListParams) => [...reportKeys.all, "operational", params] as const,
};

export function useOperationalReport(params: ReportListParams = {}) {
  return useQuery({
    queryKey: reportKeys.list(params),
    queryFn: () => reportService.list(params),
    staleTime: 60_000,
  });
}
