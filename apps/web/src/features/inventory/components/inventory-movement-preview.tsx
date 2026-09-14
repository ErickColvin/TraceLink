import { ArrowRight } from "lucide-react";

import type { InventoryMovementPreview } from "../domain";
import { InventoryStatusBadge } from "./inventory-status-badge";

export interface InventoryMovementPreviewProps {
  preview: InventoryMovementPreview;
}

function StockSnapshot({
  label,
  physicalStock,
  reservedStock,
  availableStock,
}: InventoryMovementPreview["before"] & { label: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-ink-100 bg-ink-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[0.68rem] text-ink-500">Físico</dt>
          <dd className="mt-0.5 font-bold text-ink-950">{physicalStock}</dd>
        </div>
        <div>
          <dt className="text-[0.68rem] text-ink-500">Reservado</dt>
          <dd className="mt-0.5 font-bold text-ink-950">{reservedStock}</dd>
        </div>
        <div>
          <dt className="text-[0.68rem] text-ink-500">Disponible</dt>
          <dd className="mt-0.5 font-bold text-brand-800">{availableStock}</dd>
        </div>
      </dl>
    </div>
  );
}

export function InventoryMovementPreviewCard({
  preview,
}: InventoryMovementPreviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <StockSnapshot label="Antes" {...preview.before} />
        <ArrowRight
          aria-hidden="true"
          className="mx-auto size-5 rotate-90 text-ink-400 sm:rotate-0"
        />
        <StockSnapshot label="Después" {...preview.after} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-ink-700">
          Variación física: {preview.quantityDelta > 0 ? "+" : ""}
          {preview.quantityDelta}
        </span>
        <InventoryStatusBadge status={preview.resultingStatus} />
      </div>
    </div>
  );
}
