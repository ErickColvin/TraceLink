import { describe, expect, it } from "vitest";

import { createReportCsv } from "./csv";

describe("createReportCsv", () => {
  it("escapa comillas y neutraliza fórmulas de hoja de cálculo", () => {
    const csv = createReportCsv([{
      id: "row-1",
      date: "2026-08-30",
      category: "ORDERS",
      status: "ATTENTION",
      title: '=HYPERLINK("bad")',
      reference: "Pedido, especial",
      quantity: 1,
    }]);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Pedido, especial"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});
