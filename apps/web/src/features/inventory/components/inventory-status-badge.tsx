import { Badge } from "@/components/ui";

import type { InventoryStatus } from "../domain";
import { inventoryStatusPresentation } from "../presentation/inventory-presentation";

export interface InventoryStatusBadgeProps {
  status: InventoryStatus;
}

export function InventoryStatusBadge({
  status,
}: InventoryStatusBadgeProps) {
  const presentation = inventoryStatusPresentation[status];

  return (
    <Badge tone={presentation.tone} title={presentation.description}>
      {presentation.label}
    </Badge>
  );
}
