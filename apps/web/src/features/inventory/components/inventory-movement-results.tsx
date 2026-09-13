import { ArrowDown, ArrowUp } from "lucide-react";

import { Badge, Card, CardContent } from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";

import type { InventoryMovement } from "../domain";
import { inventoryMovementTypeLabels } from "../presentation/inventory-presentation";
import { InventoryStatusBadge } from "./inventory-status-badge";

export interface InventoryMovementResultsProps {
  movements: InventoryMovement[];
}

function Delta({ value }: { value: number }) {
  const increases = value > 0;
  return (
    <Badge tone={increases ? "success" : "warning"}>
      {increases ? (
        <ArrowUp aria-hidden="true" className="mr-1 size-3" />
      ) : (
        <ArrowDown aria-hidden="true" className="mr-1 size-3" />
      )}
      {increases ? "+" : ""}
      {value}
    </Badge>
  );
}

function CompactSnapshot({ movement }: { movement: InventoryMovement }) {
  return (
    <p className="text-xs leading-5 text-ink-600">
      Físico {movement.before.physicalStock} → {movement.after.physicalStock} ·{" "}
      Disponible {movement.before.availableStock} → {movement.after.availableStock}
    </p>
  );
}

function MovementLocation({ movement }: { movement: InventoryMovement }) {
  return (
    <p className="text-xs leading-5 text-ink-600">
      {movement.originLocation}
      {movement.destinationLocation ? ` → ${movement.destinationLocation}` : ""}
    </p>
  );
}

export function InventoryMovementResults({
  movements,
}: InventoryMovementResultsProps) {
  return (
    <>
      <div
        aria-label="Historial de movimientos"
        className="grid gap-3 lg:hidden"
        role="list"
      >
        {movements.map((movement) => (
          <Card key={movement.id} role="listitem">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug text-ink-950">
                    {movement.productName}
                  </h3>
                  <p className="mt-1 text-xs text-ink-500">{movement.sku}</p>
                </div>
                <Delta value={movement.quantityDelta} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="info">
                  {inventoryMovementTypeLabels[movement.type]}
                </Badge>
                <InventoryStatusBadge status={movement.resultingStatus} />
              </div>
              <div className="mt-3 rounded-xl bg-ink-50 p-3">
                <CompactSnapshot movement={movement} />
                <div className="mt-2 border-t border-ink-100 pt-2">
                  <MovementLocation movement={movement} />
                </div>
              </div>
              {movement.reason ? (
                <p className="mt-3 text-sm text-ink-700">
                  <strong>Motivo:</strong> {movement.reason}
                </p>
              ) : null}
              {movement.notes ? (
                <p className="mt-2 text-sm text-ink-600">{movement.notes}</p>
              ) : null}
              <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                {formatDateTime(movement.createdAt)} · {movement.createdBy}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card lg:block">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Historial auditable de movimientos de inventario
          </caption>
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">Producto</th>
              <th className="px-4 py-3 font-semibold" scope="col">Movimiento</th>
              <th className="px-4 py-3 font-semibold" scope="col">Variación</th>
              <th className="px-4 py-3 font-semibold" scope="col">Antes / después</th>
              <th className="px-4 py-3 font-semibold" scope="col">Ubicación</th>
              <th className="px-4 py-3 font-semibold" scope="col">Motivo</th>
              <th className="px-4 py-3 font-semibold" scope="col">Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {movements.map((movement) => (
              <tr key={movement.id} className="align-top hover:bg-ice-50/60">
                <th className="px-4 py-4 font-normal" scope="row">
                  <p className="font-semibold text-ink-950">{movement.productName}</p>
                  <p className="mt-1 text-xs text-ink-500">{movement.sku}</p>
                  <p className="mt-1 text-xs text-ink-400">
                    {movement.batch ?? "Sin lote"}
                  </p>
                </th>
                <td className="px-4 py-4">
                  <Badge tone="info">
                    {inventoryMovementTypeLabels[movement.type]}
                  </Badge>
                  <div className="mt-2">
                    <InventoryStatusBadge status={movement.resultingStatus} />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Delta value={movement.quantityDelta} />
                </td>
                <td className="px-4 py-4">
                  <CompactSnapshot movement={movement} />
                </td>
                <td className="max-w-56 px-4 py-4">
                  <MovementLocation movement={movement} />
                </td>
                <td className="max-w-64 px-4 py-4 text-xs leading-5 text-ink-600">
                  {movement.reason ?? movement.notes ?? "Sin observaciones"}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-ink-500">
                  <time dateTime={movement.createdAt}>
                    {formatDateTime(movement.createdAt)}
                  </time>
                  <p className="mt-1">{movement.createdBy}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
