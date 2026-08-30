import { ArrowRight, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { useCurrentCustomerOrders } from "@/features/orders";
import { getOrderStatusMeta } from "@/features/orders/presentation/order-status";
import { formatClp, formatDate } from "@/lib/formatters";

export function CustomerOrdersPage() {
  const ordersQuery = useCurrentCustomerOrders({ pageSize: 24, sort: "NEWEST" });

  return (
    <div>
      <PageHeader eyebrow="Historial privado" title="Mis pedidos" description="Consulta el estado, total y detalle de compras asociadas a tu cuenta." />
      <div className="mt-7">
        {ordersQuery.isPending ? <div className="space-y-4">{Array.from({ length: 4 }, (_, index) => <LoadingSkeleton key={index} className="h-32 rounded-2xl" />)}</div> : null}
        {ordersQuery.isError ? <ErrorState title="No pudimos cargar tus pedidos" action={<Button onClick={() => void ordersQuery.refetch()}>Reintentar</Button>} /> : null}
        {ordersQuery.data?.items.length === 0 ? <EmptyState icon={<ClipboardList />} title="Aún no tienes pedidos" description="Cuando realices una compra, aparecerá aquí." /> : null}
        {ordersQuery.data && ordersQuery.data.items.length > 0 ? (
          <div className="space-y-4">
            {ordersQuery.data.items.map((order) => { const meta = getOrderStatusMeta(order.status); return (
              <Card key={order.id}>
                <CardContent className="grid gap-5 pt-5 sm:grid-cols-[1fr_auto] sm:items-center sm:pt-6">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-lg font-bold">{order.orderNumber}</h2><Badge tone={meta.tone}>{meta.label}</Badge></div><p className="mt-2 text-sm text-ink-600">Realizado el {formatDate(order.createdAt)} · {order.items.reduce((total, item) => total + item.quantity, 0)} unidades · {order.fulfillmentMethod === "PICKUP" ? "Retiro" : "Despacho"}</p><p className="mt-3 text-sm text-ink-500">{meta.description}</p></div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end"><p className="text-lg font-extrabold text-brand-950">{formatClp(order.total)}</p><Link to={`/mi-cuenta/pedidos/${order.id}`} className="grid size-11 place-items-center rounded-xl border border-ink-200 text-brand-700 hover:border-brand-300 hover:bg-brand-50" aria-label={`Ver detalle de ${order.orderNumber}`}><ArrowRight aria-hidden="true" className="size-4" /></Link></div>
                </CardContent>
              </Card>
            ); })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

