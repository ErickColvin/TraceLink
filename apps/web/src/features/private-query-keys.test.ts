import { describe, expect, it } from "vitest";

import { customerKeys } from "./customers/queries/customer-queries";
import { orderKeys } from "./orders/queries/order-queries";
import { packageKeys } from "./packages/queries/package-queries";

describe("private customer query keys", () => {
  it("partitions every customer-owned cache entry by authenticated subject", () => {
    expect(orderKeys.currentCustomerList("customer-a", {})).not.toEqual(
      orderKeys.currentCustomerList("customer-b", {}),
    );
    expect(packageKeys.currentCustomerDetail("customer-a", "package-1")).not.toEqual(
      packageKeys.currentCustomerDetail("customer-b", "package-1"),
    );
    expect(customerKeys.current("customer-a")).not.toEqual(
      customerKeys.current("customer-b"),
    );
  });
});
