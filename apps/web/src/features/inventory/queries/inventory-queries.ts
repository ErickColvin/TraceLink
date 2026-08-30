import { useQuery } from "@tanstack/react-query";

import type { InventoryListParams } from "../domain";
import { inventoryService } from "../services";

export const inventoryKeys = {
  all: ["inventory"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
  list: (params: InventoryListParams) => [...inventoryKeys.lists(), params] as const,
  details: () => [...inventoryKeys.all, "detail"] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,
};

export function useInventory(params: InventoryListParams = {}) {
  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => inventoryService.list(params),
    staleTime: 30_000,
  });
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.detail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de inventario.");
      return inventoryService.getById(id);
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
