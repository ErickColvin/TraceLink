import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { CUSTOMER_PRIVATE_QUERY_META } from "@/features/auth/query-scope";
import type { CustomerListParams } from "../domain";
import { customerService } from "../services";

export const customerKeys = {
  all: ["customers"] as const,
  current: (customerId: string) =>
    [...customerKeys.all, "current", customerId] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCurrentCustomer() {
  const { session } = useAuth();
  const customerId = session.kind === "customer" ? session.customer.customerId : null;

  return useQuery({
    queryKey: customerKeys.current(customerId ?? "anonymous"),
    queryFn: () => customerService.getCurrent(),
    enabled: Boolean(customerId),
    meta: CUSTOMER_PRIVATE_QUERY_META,
    staleTime: 5 * 60_000,
  });
}

export function useCustomers(params: CustomerListParams = {}) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => customerService.list(params),
    staleTime: 60_000,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKeys.detail(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de cliente.");
      return customerService.getById(id);
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}
