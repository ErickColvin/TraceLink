import { AlertTriangle, ArrowUpRight, Box, CalendarClock, ClipboardList, DollarSign, PackageSearch, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useDashboardOverview, type DashboardAlertSeverity } from "@/features/dashboard";
import { formatClp, formatCompactCalendarDate, formatDateTime } from "@/lib/formatters";

const severityTone: Record<DashboardAlertSeverity, "info" | "warning" | "danger"> = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "danger",
};

export function AdminDashboardPage() {
  const dashboardQuery = useDashboardOverview();

  if (dashboardQuery.isPending) {
    return <div className="space-y-6"><LoadingSkeleton className="h-24 rounded-2xl" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <LoadingSkeleton key={index} className="h-36 rounded-2xl" />)}</div><LoadingSkeleton className="h-80 rounded-2xl" /></div>;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <ErrorState title="No pudimos cargar el dashboard" description="Los indicadores operativos no están disponibles en este momento." action={<Button onClick={() => void dashboardQuery.refetch()}>Reintentar</Button>} />;
  }

  const { alerts, generatedAt, kpis, salesTrend } = dashboardQuery.data;
  const maxSales = Math.max(1, ...salesTrend.map((point) => point.salesClp));
  const metrics = [
    { label: "Ventas hoy", value: formatClp(kpis.salesTodayClp), helper: "Total confirmado", icon: DollarSign, tone: "bg-brand-700 text-white" },
    { label: "Pedidos hoy", value: String(kpis.ordersToday), helper: "Ingresados hoy", icon: ShoppingBag, tone: "bg-brand-50 text-brand-700" },
    { label: "Pedidos pendientes", value: String(kpis.pendingOrders), helper: "Requieren acción", icon: ClipboardList, tone: "bg-coral-50 text-coral-700" },
    { label: "Paquetes almacenados", value: String(kpis.storedPackages), helper: "En custodia", icon: PackageSearch, tone: "bg-brand-50 text-brand-700" },
    { label: "Stock crítico", value: String(kpis.criticalStockItems), helper: "Bajo mínimo", icon: Box, tone: "bg-coral-50 text-coral-700" },
    { label: "Próximos a vencer", value: String(kpis.expiringSoonItems), helper: "Dentro de 14 días", icon: CalendarClock, tone: "bg-coral-50 text-coral-700" },
  ] as const;

  return (
    <div>
      <PageHeader eyebrow="Resumen operativo" title="Dashboard" description={`Datos mock actualizados al ${formatDateTime(generatedAt)}.`} actions={<Badge tone="info">Frontend demo</Badge>} />

      <section aria-label="Indicadores principales" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ helper, icon: Icon, label, tone, value }) => (
          <Card key={label}><CardContent className="flex items-start justify-between gap-4 pt-5 sm:pt-6"><div><p className="text-sm font-semibold text-ink-600">{label}</p><p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink-950">{value}</p><p className="mt-2 text-xs text-ink-500">{helper}</p></div><span className={`grid size-11 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" className="size-5" /></span></CardContent></Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader><CardTitle>Ventas de los últimos 7 días</CardTitle><p className="text-sm text-ink-600">Lectura rápida de tendencia, sin pretender reemplazar una herramienta BI.</p></CardHeader>
          <CardContent>
            {salesTrend.length > 0 ? (
              <div className="flex h-64 items-end gap-2 sm:gap-4" role="list" aria-label="Ventas de los últimos siete días">
                {salesTrend.map((point) => {
                  const height = point.salesClp > 0 ? Math.max(12, Math.round((point.salesClp / maxSales) * 100)) : 0;
                  const dateLabel = formatCompactCalendarDate(point.date);
                  return <div key={point.date} role="listitem" aria-label={`${dateLabel}: ${formatClp(point.salesClp)}, ${point.orders} pedidos`} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"><span aria-hidden="true" className="mb-2 hidden text-xs font-semibold text-ink-500 md:block">{formatClp(point.salesClp)}</span><div aria-hidden="true" className="group relative mx-auto w-full max-w-14 rounded-t-xl bg-brand-600 transition-colors hover:bg-brand-700" style={{ height: `${height}%` }} /><span aria-hidden="true" className="mt-2 truncate text-[0.68rem] font-semibold text-ink-500">{dateLabel}</span></div>;
                })}
              </div>
            ) : (
              <EmptyState title="Aún no hay ventas para graficar" description="La tendencia aparecerá cuando existan ventas confirmadas en el período." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Atención requerida</CardTitle><p className="mt-1 text-sm text-ink-600">Señales operativas prioritarias.</p></div><Badge tone="warning">{alerts.length}</Badge></CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? <EmptyState title="Sin alertas pendientes" description="La operación no registra señales que requieran atención." /> : alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-ink-100 p-4">
                <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-coral-50 text-coral-700"><AlertTriangle aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-ink-950">{alert.title}</h3><Badge tone={severityTone[alert.severity]}>{alert.severity === "CRITICAL" ? "Crítico" : alert.severity === "WARNING" ? "Atención" : "Info"}</Badge></div><p className="mt-1 text-sm leading-5 text-ink-600">{alert.message}</p><p className="mt-2 text-xs text-ink-500">{formatDateTime(alert.occurredAt)}</p>{alert.href ? <Link to={alert.href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900">Abrir módulo <ArrowUpRight aria-hidden="true" className="size-3.5" /></Link> : null}</div></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
