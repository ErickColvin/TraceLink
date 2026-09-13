import { delay } from "@/lib/delay";

import { mockReportRecords } from "../data/mock-report-records";
import type { OperationalReport, ReportListParams } from "../domain";
import type { ReportService } from "./report-service";

export class MockReportService implements ReportService {
  async list(params: ReportListParams = {}): Promise<OperationalReport> {
    await delay(160);
    const items = mockReportRecords
      .filter((item) => !params.from || item.date >= params.from)
      .filter((item) => !params.to || item.date <= params.to)
      .filter((item) => !params.category || item.category === params.category)
      .filter((item) => !params.status || item.status === params.status)
      .map((item) => ({ ...item }));

    return {
      generatedAt: new Date().toISOString(),
      items,
      summary: {
        records: items.length,
        quantity: items.reduce((total, item) => total + item.quantity, 0),
        amountClp: items.reduce((total, item) => total + (item.amountClp ?? 0), 0),
        critical: items.filter((item) => item.status === "CRITICAL").length,
      },
    };
  }
}
