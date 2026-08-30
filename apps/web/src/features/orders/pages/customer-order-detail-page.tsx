import { ArrowLeft, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonStyles } from "@/components/ui";
import { useCurrentCustomerOrder } from "@/features/orders";
import { getOrderStatusMeta } from "@/features/orders/presentation/order-status";
import { formatClp, formatDateTime } from "@/lib/formatters";

export function CustomerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderQuery = useCurrentCustomerOrder(id);

  if (orderQuery.isPending) return <div className="space-y-5"><LoadingSkeleton className="h-28 rounded-2xl" /><LoadingSkeleton className="h-72 rounded-2xl" /></div>;
  if (orderQuery.isError || !orderQuery.data) return <ErrorState title="No encontramos este pedido" description="Solo puedes consultar pedidos asociados a tu cuenta." action={<Link to="/mi-cuenta/pedidos" className={buttonStyles()}><ArrowLeft aria-hidden="true" /> Mis pedidos</Link>} />;

  const order = orderQuery.data;
  const meta = getOrderStatusMeta(order.status);

  return (
    <div>
      <Link to="/mi-cuenta/pedidos" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-ink-600 hover:text-brand-700"><ArrowLeft aria-hidden="true" className="size-4" /> Mis pedidos</Link>
      <PageHeader eyebrow="Detalle de pedido" title={order.orderNumber} description={`Creado el ${formatDateTime(order.createdAt)}`} actions={<Badge tone={meta.tone}>{meta.label}</Badge>} />
      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_320px] xl:items-start">
        <Card>
          <CardHeader><CardTitle>Productos</CardTitle></CardHeader>
          <CardContent className="divide-y divide-ink-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <img
                  src={item.imageUrl ?? "/assets/ch-market-hero.jpg"}
                  alt=""
                  className="size-20 rounded-xl object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/assets/ch-market-hero.jpg";
                  }}
                />
                <div className="min-w-0 flex-1"><p className="font-bold">{item.name}</p><p className="mt-1 text-xs text-ink-500">SKU {item.sku} · Cantidad {item.quantity}</p><p className="mt-2 text-sm text-ink-600">{formatClp(item.unitPrice)} c/u</p></div>
                <p className="font-bold">{formatClp(item.lineTotal)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Resumen</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between text-ink-600"><span>Subtotal</span><span>{formatClp(order.subtotal)}</span></div><div className="flex justify-between text-ink-600"><span>Descuento</span><span>-{formatClp(order.discountTotal)}</span></div><div className="flex justify-between text-ink-600"><span>Entrega</span><span>{formatClp(order.deliveryFee)}</span></div><div className="flex justify-between border-t border-ink-100 pt-4 text-base font-extrabold"><span>Total</span><span>{formatClp(order.total)}</span></div></CardContent></Card>
          {order.pickupLocation ? <Card><CardContent className="flex gap-3 pt-5 sm:pt-6"><MapPin aria-hidden="true" className="mt-0.5 size-5 text-brand-700" /><div><p className="font-bold">Punto de retiro</p><p className="mt-1 text-sm text-ink-600">{order.pickupLocation}</p></div></CardContent></Card> : null}
        </div>
      </div>
    </div>
  );
}
