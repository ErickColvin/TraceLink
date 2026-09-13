import { Download, FileBarChart, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { formatClp, formatCompactCalendarDate, formatDateTime } from "@/lib/formatters";

import { createReportCsv } from "../csv";
import {
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  type ReportCategory,
  type ReportListParams,
  type ReportStatus,
} from "../domain";
import { useOperationalReport } from "../queries/report-queries";

const categoryLabels: Record<ReportCategory, string> = {
  SALES: "Ventas",
  ORDERS: "Pedidos",
  INVENTORY: "Inventario",
  PACKAGES: "Paquetes",
};

const statusLabels: Record<ReportStatus, string> = {
  OK: "Normal",
  ATTENTION: "Atención",
  CRITICAL: "Crítico",
};

const statusTones: Record<ReportStatus, "success" | "warning" | "danger"> = {
  OK: "success",
  ATTENTION: "warning",
  CRITICAL: "danger",
};

const selectClassName = "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

function isCategory(value: string | null): value is ReportCategory {
  return REPORT_CATEGORIES.some((category) => category === value);
}

function isStatus(value: string | null): value is ReportStatus {
  return REPORT_STATUSES.some((status) => status === value);
}

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryValue = searchParams.get("category");
  const statusValue = searchParams.get("status");
  const filters: ReportListParams = {
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    category: isCategory(categoryValue) ? categoryValue : undefined,
    status: isStatus(statusValue) ? statusValue : undefined,
  };
  const reportQuery = useOperationalReport(filters);

  const updateFilter = (name: keyof ReportListParams, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  };

  const exportCsv = () => {
    if (!reportQuery.data?.items.length) return;
    const csv = createReportCsv(reportQuery.data.items);
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tracelink-reporte-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Análisis operativo"
        title="Reportes"
        description="Consulta y exporta un resumen local de ventas, pedidos, inventario y paquetes mock."
        actions={<Button variant="outline" onClick={exportCsv} disabled={!reportQuery.data?.items.length}><Download aria-hidden="true" /> Exportar CSV</Button>}
      />

      <Card className="mt-7">
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 xl:grid-cols-4">
          <div><Label htmlFor="report-from">Desde</Label><Input id="report-from" type="date" value={filters.from ?? ""} max={filters.to} onChange={(event) => updateFilter("from", event.target.value)} /></div>
          <div><Label htmlFor="report-to">Hasta</Label><Input id="report-to" type="date" value={filters.to ?? ""} min={filters.from} onChange={(event) => updateFilter("to", event.target.value)} /></div>
          <div>
            <Label htmlFor="report-category">Categoría</Label>
            <select id="report-category" className={selectClassName} value={filters.category ?? ""} onChange={(event) => updateFilter("category", event.target.value)}>
              <option value="">Todas</option>
              {REPORT_CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="report-status">Estado</Label>
            <select id="report-status" className={selectClassName} value={filters.status ?? ""} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">Todos</option>
              {REPORT_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {reportQuery.isPending ? (
        <div className="mt-6 space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <LoadingSkeleton key={index} className="h-28 rounded-2xl" />)}</div><LoadingSkeleton className="h-80 rounded-2xl" /></div>
      ) : reportQuery.isError || !reportQuery.data ? (
        <ErrorState className="mt-6" title="No pudimos preparar el reporte" description="Reintenta la consulta de datos operativos." action={<Button onClick={() => void reportQuery.refetch()}><RefreshCw aria-hidden="true" /> Reintentar</Button>} />
      ) : (
        <>
          <section aria-label="Resumen del reporte" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="pt-5 sm:pt-6"><p className="text-sm text-ink-600">Registros</p><p className="mt-2 text-3xl font-bold">{reportQuery.data.summary.records}</p></CardContent></Card>
            <Card><CardContent className="pt-5 sm:pt-6"><p className="text-sm text-ink-600">Cantidad acumulada</p><p className="mt-2 text-3xl font-bold">{reportQuery.data.summary.quantity}</p></CardContent></Card>
            <Card><CardContent className="pt-5 sm:pt-6"><p className="text-sm text-ink-600">Monto registrado</p><p className="mt-2 text-2xl font-bold">{formatClp(reportQuery.data.summary.amountClp)}</p></CardContent></Card>
            <Card><CardContent className="pt-5 sm:pt-6"><p className="text-sm text-ink-600">Señales críticas</p><p className="mt-2 text-3xl font-bold text-coral-700">{reportQuery.data.summary.critical}</p></CardContent></Card>
          </section>

          <p className="mt-5 text-xs text-ink-500">Generado {formatDateTime(reportQuery.data.generatedAt)}</p>

          {reportQuery.data.items.length === 0 ? (
            <EmptyState className="mt-4" icon={<FileBarChart />} title="No hay registros para estos filtros" description="Amplía el período o elimina filtros para ver actividad." action={<Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>Limpiar filtros</Button>} />
          ) : (
            <Card className="mt-4 overflow-hidden">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-600"><tr><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Categoría</th><th className="px-5 py-3">Detalle</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Cantidad</th><th className="px-5 py-3 text-right">Monto</th></tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {reportQuery.data.items.map((item) => <tr key={item.id}><td className="whitespace-nowrap px-5 py-4">{formatCompactCalendarDate(item.date)}</td><td className="px-5 py-4 font-semibold">{categoryLabels[item.category]}</td><td className="px-5 py-4"><p className="font-semibold">{item.title}</p><p className="text-xs text-ink-500">{item.reference}</p></td><td className="px-5 py-4"><Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge></td><td className="px-5 py-4 text-right font-semibold">{item.quantity}</td><td className="px-5 py-4 text-right">{item.amountClp === undefined ? "—" : formatClp(item.amountClp)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-ink-100 md:hidden">
                {reportQuery.data.items.map((item) => <li key={item.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-700">{categoryLabels[item.category]}</p><h2 className="mt-1 font-bold">{item.title}</h2><p className="mt-1 text-sm text-ink-600">{item.reference}</p></div><Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge></div><dl className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-ink-500">Fecha</dt><dd className="mt-1 font-semibold">{formatCompactCalendarDate(item.date)}</dd></div><div><dt className="text-xs text-ink-500">Cantidad</dt><dd className="mt-1 font-semibold">{item.quantity}</dd></div><div><dt className="text-xs text-ink-500">Monto</dt><dd className="mt-1 font-semibold">{item.amountClp === undefined ? "—" : formatClp(item.amountClp)}</dd></div></dl></li>)}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
