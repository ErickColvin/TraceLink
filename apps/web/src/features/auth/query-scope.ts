import type { QueryClient } from "@tanstack/react-query";

export const CUSTOMER_PRIVATE_QUERY_META = Object.freeze({
  scope: "customer-private",
});

function isCustomerPrivateQuery(query: {
  meta?: Record<string, unknown>;
}): boolean {
  return query.meta?.scope === CUSTOMER_PRIVATE_QUERY_META.scope;
}

export async function clearCustomerPrivateQueries(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.cancelQueries({ predicate: isCustomerPrivateQuery });
  queryClient.removeQueries({ predicate: isCustomerPrivateQuery });
}
