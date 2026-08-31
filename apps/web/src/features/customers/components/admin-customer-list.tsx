import { Eye, Mail, PackageSearch, Phone, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge, Card, CardContent, buttonStyles } from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";

import type { StaffCustomerSummary } from "../domain";

function CustomerStatus({ status }: Readonly<{ status: StaffCustomerSummary["status"] }>) {
  return (
    <Badge tone={status === "ACTIVE" ? "success" : "danger"}>
      {status === "ACTIVE" ? "Activo" : "Inactivo"}
    </Badge>
  );
}

export function AdminCustomerList({
  customers,
}: Readonly<{ customers: readonly StaffCustomerSummary[] }>) {
  return (
    <>
      <div className="space-y-3 xl:hidden">
        {customers.map((customer) => (
          <Card key={customer.id}>
            <CardContent className="pt-5 sm:pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    className="font-semibold text-ink-950 hover:text-brand-700"
                    to={`/app/customers/${customer.id}`}
                  >
                    {customer.firstName} {customer.lastName}
                  </Link>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-ink-600">
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    {customer.email}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
                    <Phone aria-hidden="true" className="size-4 shrink-0" />
                    {customer.phone ?? "Sin teléfono"}
                  </p>
                </div>
                <CustomerStatus status={customer.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-ice-50 p-3 text-sm">
                <div>
                  <dt className="flex items-center gap-1.5 text-ink-500">
                    <ShoppingBag aria-hidden="true" className="size-4" /> Pedidos
                  </dt>
                  <dd className="mt-1 font-bold text-ink-950">{customer.orderCount}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-ink-500">
                    <PackageSearch aria-hidden="true" className="size-4" /> Paquetes activos
                  </dt>
                  <dd className="mt-1 font-bold text-ink-950">{customer.activePackageCount}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
                <p className="text-xs text-ink-500">
                  Última actividad: {formatDateTime(customer.lastActivityAt)}
                </p>
                <Link
                  aria-label={`Ver cliente ${customer.firstName} ${customer.lastName}`}
                  className={buttonStyles({ size: "sm", variant: "outline" })}
                  to={`/app/customers/${customer.id}`}
                >
                  <Eye aria-hidden="true" /> Ver
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card xl:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Directorio de clientes</caption>
          <thead className="bg-ice-50 text-xs font-semibold uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3" scope="col">Nombre</th>
              <th className="px-3 py-3" scope="col">Contacto</th>
              <th className="px-3 py-3 text-center" scope="col">Pedidos</th>
              <th className="px-3 py-3 text-center" scope="col">Paquetes activos</th>
              <th className="px-3 py-3" scope="col">Última actividad</th>
              <th className="px-3 py-3" scope="col">Estado</th>
              <th className="px-4 py-3 text-right" scope="col">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <th className="px-4 py-4 font-semibold text-ink-950" scope="row">
                  {customer.firstName} {customer.lastName}
                </th>
                <td className="px-3 py-4">
                  <p className="text-ink-900">{customer.email}</p>
                  <p className="mt-1 text-xs text-ink-500">{customer.phone ?? "Sin teléfono"}</p>
                </td>
                <td className="px-3 py-4 text-center font-bold text-ink-950">{customer.orderCount}</td>
                <td className="px-3 py-4 text-center font-bold text-ink-950">{customer.activePackageCount}</td>
                <td className="px-3 py-4 text-ink-600">{formatDateTime(customer.lastActivityAt)}</td>
                <td className="px-3 py-4"><CustomerStatus status={customer.status} /></td>
                <td className="px-4 py-4 text-right">
                  <Link
                    aria-label={`Ver cliente ${customer.firstName} ${customer.lastName}`}
                    className={buttonStyles({ size: "sm", variant: "ghost" })}
                    to={`/app/customers/${customer.id}`}
                  >
                    <Eye aria-hidden="true" /> Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
