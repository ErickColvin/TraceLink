import { ClipboardList, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "../../../components";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  buttonStyles,
} from "../../../components/ui";
import { useHasPermission } from "../../auth";
import {
  ORDER_STATUSES,
  type FulfillmentMethod,
  type OrderStatus,
  type PaymentStatus,
  type StaffOrder,
  type StaffOrderSort,
} from "../domain";
import { useStaffOrders } from "../queries/staff-order-queries";
import { getOrderStatusMeta } from "../presentation/order-status";
import { formatClp, formatDateTime } from "../../../lib/formatters";

const selectStyles =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60";

const paymentLabels: Readonly<Record<PaymentStatus, string>> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  REFUNDED: "Reembolsado",
};

function readStatus(value: string | null): OrderStatus | "ALL" {
  return ORDER_STATUSES.find((status) => status === value) ?? "ALL";
}

function OrderMobileCard({ order }: Readonly<{ order: StaffOrder }>) {
  const statusMeta = getOrderStatusMeta(order.status);

  return (
    <Card>
      <CardContent className="space-y-4 pt-5 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-ink-950">
              {order.orderNumber}
            </p>
            <p className="mt-1 text-sm text-ink-600">{order.customer.fullName}</p>
          </div>
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-500">Creado</dt>
            <dd className="mt-1 font-semibold text-ink-800">
              {formatDateTime(order.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Entrega</dt>
            <dd className="mt-1 font-semibold text-ink-800">
              {order.fulfillmentMethod === "PICKUP" ? "Retiro" : "Despacho"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Pago</dt>
            <dd className="mt-1 font-semibold text-ink-800">
              {paymentLabels[order.paymentStatus]}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Total</dt>
            <dd className="mt-1 font-extrabold text-brand-950">
              {formatClp(order.total)}
            </dd>
          </div>
        </dl>
        <Link
          to={`/app/orders/${order.id}`}
          className={buttonStyles({ className: "w-full", variant: "outline" })}
        >
          Ver detalle
        </Link>
      </CardContent>
    </Card>
  );
}

export function AdminOrdersPage() {
  const canView = useHasPermission("orders.view");
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [status, setStatus] = useState<OrderStatus | "ALL">(() =>
    readStatus(searchParams.get("status")),
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "ALL">(
    "ALL",
  );
  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    FulfillmentMethod | "ALL"
  >("ALL");
  const [sort, setSort] = useState<StaffOrderSort>("QUEUE");
  const [page, setPage] = useState(1);

  const listParams = useMemo(
    () => ({
      query,
      statuses: status === "ALL" ? undefined : [status],
      paymentStatuses:
        paymentStatus === "ALL" ? undefined : [paymentStatus],
      fulfillmentMethods:
        fulfillmentMethod === "ALL" ? undefined : [fulfillmentMethod],
      sort,
      page,
      pageSize: 8,
    }),
    [fulfillmentMethod, page, paymentStatus, query, sort, status],
  );
  const ordersQuery = useStaffOrders(listParams);

  const resetFilters = () => {
    setQuery("");
    setStatus("ALL");
    setPaymentStatus("ALL");
    setFulfillmentMethod("ALL");
    setSort("QUEUE");
    setPage(1);
  };

  if (!canView) {
    return (
      <ErrorState
        title="No tienes permiso para ver pedidos"
        description="Solicita el permiso orders.view a una persona administradora."
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operaciones"
        title="Cola de pedidos"
        description="Prioriza pagos, preparaciÃ³n y entrega sin saltar etapas del flujo operativo."
        actions={
          ordersQuery.data ? (
            <Badge tone="info">{ordersQuery.data.totalItems} pedidos</Badge>
          ) : undefined
        }
      />

      <Card className="mt-6">
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 xl:grid-cols-5">
          <div className="sm:col-span-2 xl:col-span-1">
            <Label htmlFor="staff-order-search">Buscar</Label>
            <div className="relative mt-1.5">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              />
              <Input
                id="staff-order-search"
                value={query}
                className="pl-9"
                placeholder="Pedido, cliente o SKU"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="staff-order-status">Estado</Label>
            <select
              id="staff-order-status"
              className={`${selectStyles} mt-1.5`}
              value={status}
              onChange={(event) => {
                setStatus(readStatus(event.target.value));
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              {ORDER_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {getOrderStatusMeta(option).label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="staff-order-payment">Pago</Label>
            <select
              id="staff-order-payment"
              className={`${selectStyles} mt-1.5`}
              value={paymentStatus}
              onChange={(event) => {
                const next = (["PENDING", "PAID", "REFUNDED"] as const).find(
                  (option) => option === event.target.value,
                );
                setPaymentStatus(next ?? "ALL");
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagado</option>
              <option value="REFUNDED">Reembolsado</option>
            </select>
          </div>
          <div>
            <Label htmlFor="staff-order-fulfillment">Entrega</Label>
            <select
              id="staff-order-fulfillment"
              className={`${selectStyles} mt-1.5`}
              value={fulfillmentMethod}
              onChange={(event) => {
                const next = (["PICKUP", "DELIVERY"] as const).find(
                  (option) => option === event.target.value,
                );
                setFulfillmentMethod(next ?? "ALL");
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              <option value="PICKUP">Retiro</option>
              <option value="DELIVERY">Despacho</option>
            </select>
          </div>
          <div>
            <Label htmlFor="staff-order-sort">Orden</Label>
            <select
              id="staff-order-sort"
              className={`${selectStyles} mt-1.5`}
              value={sort}
              onChange={(event) => {
                const next = (["QUEUE", "NEWEST", "OLDEST", "TOTAL_DESC"] as const).find(
                  (option) => option === event.target.value,
                );
                setSort(next ?? "QUEUE");
                setPage(1);
              }}
            >
              <option value="QUEUE">Prioridad operativa</option>
              <option value="NEWEST">MÃ¡s recientes</option>
              <option value="OLDEST">MÃ¡s antiguos</option>
              <option value="TOTAL_DESC">Mayor total</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {ordersQuery.isPending ? (
          <div className="space-y-3" aria-label="Cargando pedidos">
            {Array.from({ length: 5 }, (_, index) => (
              <LoadingSkeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : null}

        {ordersQuery.isError ? (
          <ErrorState
            title="No pudimos cargar la cola de pedidos"
            description="Reintenta para consultar nuevamente el servicio operativo."
            action={
              <Button onClick={() => void ordersQuery.refetch()}>Reintentar</Button>
            }
          />
        ) : null}

        {ordersQuery.data?.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="No hay pedidos para estos filtros"
            description="Ajusta la bÃºsqueda o restablece los filtros de la cola."
            action={<Button onClick={resetFilters}>Limpiar filtros</Button>}
          />
        ) : null}

        {ordersQuery.data && ordersQuery.data.items.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {ordersQuery.data.items.map((order) => (
                <OrderMobileCard key={order.id} order={order} />
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card md:block">
              <table className="min-w-full divide-y divide-ink-100 text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold">Pedido</th>
                    <th scope="col" className="px-4 py-3 font-bold">Cliente</th>
                    <th scope="col" className="px-4 py-3 font-bold">Estado</th>
                    <th scope="col" className="px-4 py-3 font-bold">Entrega</th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">Total</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {ordersQuery.data.items.map((order) => {
                    const statusMeta = getOrderStatusMeta(order.status);
                    return (
                      <tr key={order.id} className="align-middle hover:bg-ice-50/70">
                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="font-bold text-ink-950">{order.orderNumber}</p>
                          <p className="mt-1 text-xs text-ink-500">{formatDateTime(order.createdAt)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-ink-800">{order.customer.fullName}</p>
                          <p className="mt-1 text-xs text-ink-500">{order.customer.email}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                          <p className="mt-2 text-xs text-ink-500">{paymentLabels[order.paymentStatus]}</p>
                        </td>
                        <td className="px-4 py-4 text-ink-700">
                          {order.fulfillmentMethod === "PICKUP" ? "Retiro" : "Despacho"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-extrabold text-brand-950">
                          {formatClp(order.total)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            to={`/app/orders/${order.id}`}
                            className={buttonStyles({ size: "sm", variant: "outline" })}
                            aria-label={`Ver detalle de ${order.orderNumber}`}
                          >
                            Ver
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <nav
              className="mt-5 flex flex-wrap items-center justify-between gap-3"
              aria-label="PaginaciÃ³n de pedidos"
            >
              <p className="text-sm text-ink-600">
                PÃ¡gina {ordersQuery.data.page} de {ordersQuery.data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || ordersQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    page >= ordersQuery.data.totalPages || ordersQuery.isFetching
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </nav>
          </>
        ) : null}
      </div>
    </div>
  );
}
