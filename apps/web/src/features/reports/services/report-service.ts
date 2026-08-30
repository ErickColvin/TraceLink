import type { OperationalReport, ReportListParams } from "../domain";

export interface ReportService {
  list(params?: ReportListParams): Promise<OperationalReport>;
}
