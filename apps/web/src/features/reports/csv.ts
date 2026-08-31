import type { OperationalReportRecord } from "./domain";

function safeCsvCell(value: string | number): string {
  const raw = String(value);
  let firstVisibleIndex = 0;
  while (
    firstVisibleIndex < raw.length &&
    raw.charCodeAt(firstVisibleIndex) <= 0x20
  ) {
    firstVisibleIndex += 1;
  }
  const firstVisibleCharacter = raw[firstVisibleIndex];
  const protectedValue =
    firstVisibleCharacter && "=+-@".includes(firstVisibleCharacter)
      ? `'${raw}`
      : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function createReportCsv(items: readonly OperationalReportRecord[]): string {
  const header = ["Fecha", "Categoría", "Estado", "Detalle", "Referencia", "Cantidad", "Monto CLP"];
  const rows = items.map((item) => [
    item.date,
    item.category,
    item.status,
    item.title,
    item.reference,
    item.quantity,
    item.amountClp ?? "",
  ]);

  return [header, ...rows].map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
}
