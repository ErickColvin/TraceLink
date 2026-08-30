import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  clearCustomerPrivateQueries,
  CUSTOMER_PRIVATE_QUERY_META,
} from "./query-scope";

describe("customer-private query scope", () => {
  it("removes private customer data while preserving public cache entries", async () => {
    const queryClient = new QueryClient();

    await queryClient.fetchQuery({
      queryKey: ["orders", "current-customer", "customer-a"],
      queryFn: () => ({ orderNumber: "A-1" }),
      meta: CUSTOMER_PRIVATE_QUERY_META,
    });
    queryClient.setQueryData(["products", "list"], [{ id: "product-1" }]);

    await clearCustomerPrivateQueries(queryClient);

    expect(
      queryClient.getQueryData(["orders", "current-customer", "customer-a"]),
    ).toBeUndefined();
    expect(queryClient.getQueryData(["products", "list"])).toEqual([
      { id: "product-1" },
    ]);
  });
});
