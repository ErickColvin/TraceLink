import { ArrowRight, CalendarClock, ClipboardList, PackageCheck, PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonStyles } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useCurrentCustomerOrders } from "@/features/orders";
import { getOrderStatusMeta } from "@/features/orders/presentation/order-status";
import { useCurrentCustomerPackages } from "@/features/packages";
import { getPackageStatusMeta } from "@/features/packages/presentation/package-status";
import { formatClp, formatDate } from "@/lib/formatters";

export function CustomerHomePage() {
  const { session } = useAuth();
  const ordersQuery = useCurrentCustomerOrders({ pageSize: 4, sort: "NEWEST" });
  const packagesQuery = useCurrentCustomerPackages({ pageSize: 4, sort: "NEWEST" });
  const firstName = session.kind === "customer" ? session.customer.firstName : "";

  if (ordersQuery.isError || packagesQuery.isError) {
    return <ErrorState title="No pudimos cargar tu resumen" description="Tus datos siguen privados. Intenta cargar la vista nuevamente." />;
  }

  const orders = ordersQuery.data?.items ?? [];
  const packages = packagesQuery.data?.items ?? [];
  const activePackages = packages.filter((item) => !["PICKED_UP", "RETURNED"].includes(item.status));
  const pendingOrders = orders.filter((order) => !["COMPLETED", "CANCELLED", "REFUNDED"].includes(order.status));

  return (
    <div>
      <PageHeader eyebrow="Mi cuenta" title={`Hola${firstName ? `, ${firstName}` : ""}`} description="Aquí tienes una vista rápida de tus pedidos y paquetes. Los datos pertenecen exclusivamente a la sesión cliente." />

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {ordersQuery.isPending || packagesQuery.isPending ? (
          Array.from({ length: 3 }, (_, index) => <LoadingSkeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <Card><CardContent className="pt-5 sm:pt-6"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><ClipboardList aria-hidden="true" className="size-5" /></span><p className="mt-4 text-3xl font-extrabold">{orders.length}</p><p className="mt-1 text-sm text-ink-600">Pedidos recientes</p></CardContent></Card>
            <Card><CardContent className="pt-5 sm:pt-6"><span className="grid size-10 place-items-center rounded-xl bg-coral-50 text-coral-700"><CalendarClock aria-hidden="true" className="size-5" /></span><p className="mt-4 text-3xl font-extrabold">{pendingOrders.length}</p><p className="mt-1 text-sm text-ink-600">Pedidos en curso</p></CardContent></Card>
            <Card><CardContent className="pt-5 sm:pt-6"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><PackageSearch aria-hidden="true" className="size-5" /></span><p className="mt-4 text-3xl font-extrabold">{activePackages.length}</p><p className="mt-1 text-sm text-ink-600">Paquetes activos</p></CardContent></Card>
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Últimos pedidos</CardTitle><Link to="/mi-cuenta/pedidos" className="text-sm font-bold text-brand-700 hover:text-brand-900">Ver todos</Link></CardHeader>
          <CardContent className="space-y-3">
            {ordersQuery.isPending ? <LoadingSkeleton className="h-36" /> : orders.length === 0 ? <EmptyState className="min-h-44" title="Aún no tienes pedidos" description="Tus pedidos asociados a esta cuenta aparecerán aquí." /> : orders.slice(0, 3).map((order) => { const meta = getOrderStatusMeta(order.status); return (
              <Link key={order.id} to={`/mi-cuenta/pedidos/${order.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-ink-100 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/50">
                <div><p className="font-bold text-ink-950">{order.orderNumber}</p><p className="mt-1 text-xs text-ink-500">{formatDate(order.createdAt)} · {order.items.length} productos</p></div>
                <div className="text-right"><Badge tone={meta.tone}>{meta.label}</Badge><p className="mt-2 text-sm font-bold">{formatClp(order.total)}</p></div>
              </Link>
            ); })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Paquetes recientes</CardTitle><Link to="/mi-cuenta/paquetes" className="text-sm font-bold text-brand-700 hover:text-brand-900">Ver todos</Link></CardHeader>
          <CardContent className="space-y-3">
            {packagesQuery.isPending ? <LoadingSkeleton className="h-36" /> : packages.length === 0 ? <EmptyState className="min-h-44" title="Aún no tienes paquetes" description="Los paquetes asociados a esta cuenta aparecerán aquí." /> : packages.slice(0, 3).map((item) => { const meta = getPackageStatusMeta(item.status); return (
              <Link key={item.id} to={`/mi-cuenta/paquetes/${item.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-ink-100 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/50">
                <div className="min-w-0"><p className="truncate font-bold text-ink-950">{item.trackingCode}</p><p className="mt-1 truncate text-xs text-ink-500">{item.contents.description}</p></div>
                <Badge tone={meta.tone}>{meta.shortLabel}</Badge>
              </Link>
            ); })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-5 rounded-2xl bg-brand-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-coral-300"><PackageCheck aria-hidden="true" /></span><div><h2 className="font-bold">¿Esperas un paquete?</h2><p className="mt-1 text-sm text-ice-200">Revisa su recorrido y ubicación desde tu cuenta.</p></div></div>
        <Link to="/mi-cuenta/paquetes" className={buttonStyles({ className: "bg-white text-brand-950 hover:bg-ice-100" })}>Ver seguimiento <ArrowRight aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
