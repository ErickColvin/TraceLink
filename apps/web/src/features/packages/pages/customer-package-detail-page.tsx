import { ArrowLeft, Box, CalendarClock, MapPin, Snowflake } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonStyles } from "@/components/ui";
import { TrackingTimeline } from "@/features/packages/components/tracking-timeline";
import { useCurrentCustomerPackage } from "@/features/packages";
import { getPackageStatusMeta } from "@/features/packages/presentation/package-status";
import { formatDateTime } from "@/lib/formatters";

export function CustomerPackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const packageQuery = useCurrentCustomerPackage(id);

  if (packageQuery.isPending) return <div className="grid gap-6 xl:grid-cols-[1fr_320px]"><LoadingSkeleton className="h-[620px] rounded-2xl" /><LoadingSkeleton className="h-72 rounded-2xl" /></div>;
  if (packageQuery.isError || !packageQuery.data) return <ErrorState title="No encontramos este paquete" description="Solo puedes consultar paquetes asociados a tu cuenta." action={<Link to="/mi-cuenta/paquetes" className={buttonStyles()}><ArrowLeft aria-hidden="true" /> Mis paquetes</Link>} />;

  const item = packageQuery.data;
  const meta = getPackageStatusMeta(item.status);

  return (
    <div>
      <Link to="/mi-cuenta/paquetes" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-ink-600 hover:text-brand-700"><ArrowLeft aria-hidden="true" className="size-4" /> Mis paquetes</Link>
      <PageHeader eyebrow="Detalle de paquete" title={item.trackingCode} description={meta.description} actions={<Badge tone={meta.tone}>{meta.label}</Badge>} />
      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_320px] xl:items-start">
        <Card><CardHeader><CardTitle>Recorrido del paquete</CardTitle><p className="text-sm text-ink-600">Cada evento incluye fecha y ubicación cuando corresponde.</p></CardHeader><CardContent><TrackingTimeline currentStatus={item.status} events={item.events} /></CardContent></Card>
        <aside className="space-y-5">
          <Card><CardHeader><CardTitle>Información</CardTitle></CardHeader><CardContent className="space-y-5 text-sm"><div className="flex gap-3"><Box aria-hidden="true" className="mt-0.5 size-4 text-brand-700" /><div><p className="font-semibold">Contenido</p><p className="mt-1 text-ink-600">{item.contents.description} · {item.contents.itemCount} artículos</p></div></div>{item.contents.requiresColdStorage ? <div className="flex gap-3"><Snowflake aria-hidden="true" className="mt-0.5 size-4 text-brand-700" /><div><p className="font-semibold">Cadena de frío</p><p className="mt-1 text-ink-600">Requiere almacenamiento refrigerado.</p></div></div> : null}{item.storageLocation ? <div className="flex gap-3"><MapPin aria-hidden="true" className="mt-0.5 size-4 text-brand-700" /><div><p className="font-semibold">Ubicación</p><p className="mt-1 text-ink-600">{item.storageLocation}</p></div></div> : null}{item.pickupDeadline ? <div className="flex gap-3"><CalendarClock aria-hidden="true" className="mt-0.5 size-4 text-brand-700" /><div><p className="font-semibold">Retirar antes de</p><p className="mt-1 text-ink-600">{formatDateTime(item.pickupDeadline)}</p></div></div> : null}</CardContent></Card>
          {item.orderId ? <Link to={`/mi-cuenta/pedidos/${item.orderId}`} className={buttonStyles({ variant: "outline", className: "w-full" })}>Ver pedido asociado</Link> : null}
        </aside>
      </div>
    </div>
  );
}

