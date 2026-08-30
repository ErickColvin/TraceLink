import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { CUSTOMER_PRIVATE_QUERY_META } from "@/features/auth/query-scope";
import type { CurrentCustomerOrderListParams } from "../domain";
import { orderService } from "../services";

export const orderKeys = {
  all: ["orders"] as const,
  currentCustomer: (customerId: string) =>
    [...orderKeys.all, "current-customer", customerId] as const,
  currentCustomerLists: (customerId: string) =>
    [...orderKeys.currentCustomer(customerId), "list"] as const,
  currentCustomerList: (
    customerId: string,
    params: CurrentCustomerOrderListParams,
  ) => [...orderKeys.currentCustomerLists(customerId), params] as const,
  currentCustomerDetails: (customerId: string) =>
    [...orderKeys.currentCustomer(customerId), "detail"] as const,
  currentCustomerDetail: (customerId: string, id: string) =>
    [...orderKeys.currentCustomerDetails(customerId), id] as const,
};

export function useCurrentCustomerOrders(params: CurrentCustomerOrderListParams = {}) {
  const { session } = useAuth();
  const customerId = session.kind === "customer" ? session.customer.customerId : null;

  return useQuery({
    queryKey: orderKeys.currentCustomerList(customerId ?? "anonymous", params),
    queryFn: () => orderService.listCurrentCustomer(params),
    enabled: Boolean(customerId),
    meta: CUSTOMER_PRIVATE_QUERY_META,
    staleTime: 30_000,
  });
}

export function useCurrentCustomerOrder(id: string | undefined) {
  const { session } = useAuth();
  const customerId = session.kind === "customer" ? session.customer.customerId : null;

  return useQuery({
    queryKey: orderKeys.currentCustomerDetail(customerId ?? "anonymous", id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de pedido.");
      return orderService.getCurrentCustomerById(id);
    },
    enabled: Boolean(customerId && id),
    meta: CUSTOMER_PRIVATE_QUERY_META,
    staleTime: 30_000,
  });
}
