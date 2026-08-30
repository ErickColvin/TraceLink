import { MockReportService } from "./services/mock-report-service";
import type { ReportService } from "./services/report-service";

export const reportService: ReportService = new MockReportService();
