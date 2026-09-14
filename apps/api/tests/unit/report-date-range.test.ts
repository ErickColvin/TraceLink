import { describe, expect, it } from "vitest";

import {
  MAX_REPORT_RANGE_DAYS,
  resolveReportDateRange,
} from "../../src/modules/reports/report-repository.js";

describe("resolveReportDateRange", () => {
  it("uses a bounded 30-day default window", () => {
    expect(resolveReportDateRange({}, "2026-09-02")).toEqual({
      from: "2026-08-04",
      to: "2026-09-02",
    });
  });

  it("derives a 30-day window from an explicit end date", () => {
    expect(resolveReportDateRange({ to: "2026-02-10" }, "2026-09-02"))
      .toEqual({ from: "2026-01-12", to: "2026-02-10" });
  });

  it("accepts the documented inclusive maximum", () => {
    expect(
      resolveReportDateRange(
        { from: "2025-09-02", to: "2026-09-02" },
        "2026-09-02",
      ),
    ).toEqual({ from: "2025-09-02", to: "2026-09-02" });
    expect(MAX_REPORT_RANGE_DAYS).toBe(366);
  });

  it("rejects an inverted or excessive range", () => {
    expect(() =>
      resolveReportDateRange(
        { from: "2026-09-03", to: "2026-09-02" },
        "2026-09-02",
      ),
    ).toThrow("fecha inicial");
    expect(() =>
      resolveReportDateRange(
        { from: "2025-09-01", to: "2026-09-02" },
        "2026-09-02",
      ),
    ).toThrow("366");
  });
});
