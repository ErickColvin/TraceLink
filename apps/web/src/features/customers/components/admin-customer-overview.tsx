import {
  Activity,
  Clock3,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { getOrderStatusMeta } from "@/features/orders/presentation/order-status";
import { getPackageStatusMeta } from "@/features/packages/presentation/package-status";
import { formatClp, formatDateTime } from "@/lib/formatters";

import type { StaffCustomerDetail } from "../domain";

const actorLabels: Record<
  StaffCustomerDetail["activity"][number]["actor"],
  string
> = {
  CUSTOMER: "Cliente",
  STAFF: "Personal",
  SYSTEM: "Sistema",
};

function ContactCard({ detail }: Readonly<{ detail: StaffCustomerDetail }>) {
  const { customer } = detail;
  const address = customer.address;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound aria-hidden="true" className="size-5 text-brand-700" />
          Datos personales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="flex gap-3">
          <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Correo</p>
            <a className="mt-1 block break-all font-semibold text-ink-950 hover:text-brand-700" href={`mailto:${customer.email}`}>
              {customer.email}
            </a>
          </div>
        </div>
        <div className="flex gap-3">
          <Phone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Teléfono</p>
            {customer.phone ? (
              <a className="mt-1 block font-semibold text-ink-950 hover:text-brand-700" href={`tel:${customer.phone}`}>
                {customer.phone}
              </a>
            ) : (
              <p className="mt-1 text-ink-600">Sin teléfono registrado</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 border-t border-ink-100 pt-5">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Dirección</p>
            {address ? (
              <address className="mt-1 not-italic leading-6 text-ink-800">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.commune}, {address.city}
                <br />
                {address.region}
              </address>
            ) : (
              <p className="mt-1 text-ink-600">Sin dirección registrada</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCards({ detail }: Readonly<{ detail: StaffCustomerDetail }>) {
  const summaries = [
    {
      label: "Pedidos",
      value: detail.orderCount,
      icon: ShoppingBag,
    },
    {
      label: "Paquetes activos",
      value: detail.activePackageCount,
      icon: PackageSearch,
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {summaries.map(({ icon: Icon, label, value }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-4 pt-5 sm:pt-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-ink-950">{value}</p>
              <p className="text-sm text-ink-600">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentOrders({ detail }: Readonly<{ detail: StaffCustomerDetail }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag aria-hidden="true" className="size-5 text-brand-700" />
          Pedidos recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {detail.recentOrders.length === 0 ? (
          <p className="rounded-xl bg-ice-50 p-4 text-sm text-ink-600">
            Este cliente aún no tiene pedidos registrados.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {detail.recentOrders.map((order) => {
              const status = getOrderStatusMeta(order.status);
              return (
                <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={order.id}>
                  <div>
                    <Link className="font-bold text-ink-950 hover:text-brand-700" to={`/app/orders/${order.id}`}>
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-xs text-ink-500">
                      {formatDateTime(order.updatedAt)} · {formatClp(order.total)}
                    </p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivePackages({ detail }: Readonly<{ detail: StaffCustomerDetail }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch aria-hidden="true" className="size-5 text-brand-700" />
          Paquetes actuales
        </CardTitle>
      </CardHeader>
      <CardContent>
        {detail.activePackages.length === 0 ? (
          <p className="rounded-xl bg-ice-50 p-4 text-sm text-ink-600">
            No hay paquetes activos para este cliente.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {detail.activePackages.map((item) => {
              const status = getPackageStatusMeta(item.status);
              return (
                <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
                  <div className="min-w-0">
                    <Link className="font-bold text-ink-950 hover:text-brand-700" to={`/app/packages/${item.id}`}>
                      {item.trackingCode}
                    </Link>
                    <p className="mt-1 truncate text-xs text-ink-500">
                      {item.description} · {formatDateTime(item.updatedAt)}
                    </p>
                  </div>
                  <Badge tone={status.tone}>{status.shortLabel}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityHistory({ detail }: Readonly<{ detail: StaffCustomerDetail }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity aria-hidden="true" className="size-5 text-brand-700" />
          Historial y actividad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {detail.activity.map((event) => (
            <li className="relative grid grid-cols-[1.75rem_1fr] gap-3" key={event.id}>
              <span className="mt-0.5 grid size-7 place-items-center rounded-full bg-ice-100 text-brand-700">
                <Clock3 aria-hidden="true" className="size-3.5" />
              </span>
              <div className="min-w-0 border-b border-ink-100 pb-4 last:border-b-0">
                <p className="font-semibold text-ink-900">{event.description}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {formatDateTime(event.occurredAt)} · {actorLabels[event.actor]}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function AdminCustomerOverview({
  detail,
}: Readonly<{ detail: StaffCustomerDetail }>) {
  return (
    <div className="space-y-6">
      <SummaryCards detail={detail} />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <ContactCard detail={detail} />
        <div className="space-y-6">
          <RecentOrders detail={detail} />
          <ActivePackages detail={detail} />
        </div>
      </div>
      <ActivityHistory detail={detail} />
    </div>
  );
}
