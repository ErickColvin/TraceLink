import type { OperationalReportRecord } from "../domain";

export const mockReportRecords: readonly OperationalReportRecord[] = [
  { id: "report-01", date: "2026-08-30", category: "SALES", status: "OK", title: "Ventas confirmadas", reference: "Cierre diario", quantity: 18, amountClp: 428_900 },
  { id: "report-02", date: "2026-08-30", category: "ORDERS", status: "ATTENTION", title: "Pedidos pendientes", reference: "PENDING_PAYMENT", quantity: 5 },
  { id: "report-03", date: "2026-08-30", category: "PACKAGES", status: "ATTENTION", title: "Paquetes por retirar", reference: "READY_FOR_PICKUP", quantity: 7 },
  { id: "report-04", date: "2026-08-30", category: "INVENTORY", status: "CRITICAL", title: "Productos sin stock", reference: "OUT", quantity: 2 },
  { id: "report-05", date: "2026-08-29", category: "SALES", status: "OK", title: "Ventas confirmadas", reference: "Cierre diario", quantity: 21, amountClp: 516_450 },
  { id: "report-06", date: "2026-08-29", category: "INVENTORY", status: "ATTENTION", title: "Lotes próximos a vencer", reference: "EXPIRING", quantity: 4 },
  { id: "report-07", date: "2026-08-28", category: "ORDERS", status: "OK", title: "Pedidos completados", reference: "COMPLETED", quantity: 16, amountClp: 377_800 },
  { id: "report-08", date: "2026-08-28", category: "PACKAGES", status: "CRITICAL", title: "Incidentes de paquete", reference: "INCIDENT", quantity: 1 },
  { id: "report-09", date: "2026-08-27", category: "SALES", status: "OK", title: "Ventas confirmadas", reference: "Cierre diario", quantity: 14, amountClp: 301_200 },
  { id: "report-10", date: "2026-08-27", category: "INVENTORY", status: "OK", title: "Recepciones de compra", reference: "PURCHASE_RECEIPT", quantity: 38 },
];
