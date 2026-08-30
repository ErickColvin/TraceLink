import { describe, expect, it } from "vitest";

import { formatCompactCalendarDate } from "./formatters";

describe("formatCompactCalendarDate", () => {
  it("preserves the calendar day instead of shifting a UTC date in Santiago", () => {
    expect(formatCompactCalendarDate("2026-08-23")).toMatch(/^23(?:\s|-)/);
  });

  it("rejects invalid calendar dates", () => {
    expect(() => formatCompactCalendarDate("2026-02-30")).toThrow(RangeError);
  });
});
