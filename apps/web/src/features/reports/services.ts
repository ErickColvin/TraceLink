import { applicationServices } from "../service-composition";
import type { ReportService } from "./services/report-service";

export const reportService: ReportService = applicationServices.reportService;
