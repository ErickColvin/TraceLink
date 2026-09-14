import { MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/formatters";

import type { InventoryItem } from "../domain";
import { InventoryStatusBadge } from "./inventory-status-badge";

export interface InventoryResultsProps {
  items: InventoryItem[];
}

function Expiry({ expiresAt }: Pick<InventoryItem, "expiresAt">) {
  return expiresAt ? (
    <time dateTime={expiresAt}>{formatDate(expiresAt)}</time>
  ) : (
    <span className="text-ink-400">Sin vencimiento</span>
  );
}

export function InventoryResults({ items }: InventoryResultsProps) {
  return (
    <>
      <div
        aria-label="Resultados de inventario"
        className="grid gap-3 lg:hidden"
        role="list"
      >
        {items.map((item) => (
          <Card key={item.id} role="listitem">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug text-ink-950">
                    {item.productName}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-ink-500">
                    {item.sku} · {item.categoryName}
                  </p>
                </div>
                <InventoryStatusBadge status={item.status} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-ink-500">Físico</dt>
                  <dd className="mt-1 font-bold text-ink-950">
                    {item.physicalStock}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Reservado</dt>
                  <dd className="mt-1 font-bold text-ink-950">
                    {item.reservedStock}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Disponible</dt>
                  <dd className="mt-1 font-bold text-ink-950">
                    {item.availableStock}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Mínimo</dt>
                  <dd className="mt-1 font-bold text-ink-950">
                    {item.minimumStock}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Lote</dt>
                  <dd className="mt-1 font-medium text-ink-800">
                    {item.batch ?? "Sin lote"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Vencimiento</dt>
                  <dd className="mt-1 font-medium text-ink-800">
                    <Expiry expiresAt={item.expiresAt} />
                  </dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2 border-t border-ink-100 pt-3 text-xs text-ink-600">
                <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                {item.location}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card lg:block">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Inventario por producto y lote con stock físico, reservado y disponible
          </caption>
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">
                Producto
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Estado
              </th>
              <th className="px-3 py-3 text-right font-semibold" scope="col">
                Físico
              </th>
              <th className="px-3 py-3 text-right font-semibold" scope="col">
                Reservado
              </th>
              <th className="px-3 py-3 text-right font-semibold" scope="col">
                Disponible
              </th>
              <th className="px-3 py-3 text-right font-semibold" scope="col">
                Mínimo
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Lote y vencimiento
              </th>
              <th className="px-4 py-3 font-semibold" scope="col">
                Ubicación
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((item) => (
              <tr key={item.id} className="align-top hover:bg-ice-50/60">
                <th className="px-4 py-4 font-normal" scope="row">
                  <p className="font-semibold text-ink-950">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {item.sku} · {item.categoryName}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Actualizado {formatDateTime(item.updatedAt)}
                  </p>
                </th>
                <td className="px-4 py-4">
                  <InventoryStatusBadge status={item.status} />
                </td>
                <td className="px-3 py-4 text-right font-semibold text-ink-900">
                  {item.physicalStock}
                </td>
                <td className="px-3 py-4 text-right text-ink-700">
                  {item.reservedStock}
                </td>
                <td className="px-3 py-4 text-right font-bold text-brand-800">
                  {item.availableStock}
                </td>
                <td className="px-3 py-4 text-right text-ink-700">
                  {item.minimumStock}
                </td>
                <td className="px-4 py-4 text-ink-700">
                  <p className="font-medium">{item.batch ?? "Sin lote"}</p>
                  <p className="mt-1 text-xs">
                    <Expiry expiresAt={item.expiresAt} />
                  </p>
                </td>
                <td className="max-w-56 px-4 py-4 text-xs leading-5 text-ink-600">
                  {item.location}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
