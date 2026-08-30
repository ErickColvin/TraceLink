import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { CUSTOMER_PRIVATE_QUERY_META } from "@/features/auth/query-scope";
import type { CurrentCustomerPackageListParams } from "../domain";
import { packageService } from "../services";

export const packageKeys = {
  all: ["packages"] as const,
  currentCustomer: (customerId: string) =>
    [...packageKeys.all, "current-customer", customerId] as const,
  currentCustomerLists: (customerId: string) =>
    [...packageKeys.currentCustomer(customerId), "list"] as const,
  currentCustomerList: (
    customerId: string,
    params: CurrentCustomerPackageListParams,
  ) => [...packageKeys.currentCustomerLists(customerId), params] as const,
  currentCustomerDetails: (customerId: string) =>
    [...packageKeys.currentCustomer(customerId), "detail"] as const,
  currentCustomerDetail: (customerId: string, id: string) =>
    [...packageKeys.currentCustomerDetails(customerId), id] as const,
};

export function useCurrentCustomerPackages(params: CurrentCustomerPackageListParams = {}) {
  const { session } = useAuth();
  const customerId = session.kind === "customer" ? session.customer.customerId : null;

  return useQuery({
    queryKey: packageKeys.currentCustomerList(customerId ?? "anonymous", params),
    queryFn: () => packageService.listCurrentCustomer(params),
    enabled: Boolean(customerId),
    meta: CUSTOMER_PRIVATE_QUERY_META,
    staleTime: 30_000,
  });
}

export function useCurrentCustomerPackage(id: string | undefined) {
  const { session } = useAuth();
  const customerId = session.kind === "customer" ? session.customer.customerId : null;

  return useQuery({
    queryKey: packageKeys.currentCustomerDetail(customerId ?? "anonymous", id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de paquete.");
      return packageService.getCurrentCustomerById(id);
    },
    enabled: Boolean(customerId && id),
    meta: CUSTOMER_PRIVATE_QUERY_META,
    staleTime: 30_000,
  });
}
