import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CreateInventoryMovementInput,
  InventoryListParams,
  InventoryMovementListParams,
} from "../domain";
import { inventoryService } from "../services";

export const inventoryKeys = {
  all: ["inventory"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
  list: (params: InventoryListParams) => [...inventoryKeys.lists(), params] as const,
  categories: () => [...inventoryKeys.all, "categories"] as const,
  details: () => [...inventoryKeys.all, "detail"] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,
  movements: () => [...inventoryKeys.all, "movements"] as const,
  movementList: (params: InventoryMovementListParams) =>
    [...inventoryKeys.movements(), params] as const,
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

export function useInventoryCategories() {
  return useQuery({
    queryKey: inventoryKeys.categories(),
    queryFn: () => inventoryService.listCategories(),
    staleTime: 5 * 60_000,
  });
}

export function useInventoryMovements(
  params: InventoryMovementListParams = {},
) {
  return useQuery({
    queryKey: inventoryKeys.movementList(params),
    queryFn: () => inventoryService.listMovements(params),
    staleTime: 15_000,
  });
}

export function useCreateInventoryMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInventoryMovementInput) =>
      inventoryService.createMovement(input),
    onSuccess: async (movement) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: inventoryKeys.detail(movement.inventoryItemId),
        }),
        queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}
