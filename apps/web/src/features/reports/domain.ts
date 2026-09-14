export const REPORT_CATEGORIES = ["SALES", "ORDERS", "INVENTORY", "PACKAGES"] as const;
export const REPORT_STATUSES = ["OK", "ATTENTION", "CRITICAL"] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type OperationalReportRecord = {
  id: string;
  date: string;
  category: ReportCategory;
  status: ReportStatus;
  title: string;
  reference: string;
  quantity: number;
  amountClp?: number;
};

export type ReportListParams = {
  from?: string;
  to?: string;
  category?: ReportCategory;
  status?: ReportStatus;
};

export type OperationalReport = {
  generatedAt: string;
  items: OperationalReportRecord[];
  summary: {
    records: number;
    quantity: number;
    amountClp: number;
    critical: number;
  };
};
