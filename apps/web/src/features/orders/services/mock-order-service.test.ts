import { describe, expect, it } from "vitest";

import { DEMO_CUSTOMER_ID, type CurrentCustomerResolver } from "../../mock-context";
import { MockOrderService } from "./mock-order-service";

const demoCustomerResolver: CurrentCustomerResolver = {
  requireCurrentCustomerId: () => DEMO_CUSTOMER_ID,
};

describe("MockOrderService", () => {
  it("only exposes orders belonging to the current customer", async () => {
    const service = new MockOrderService(demoCustomerResolver);

    const result = await service.listCurrentCustomer();

    expect(result.items).not.toHaveLength(0);
    expect(
      result.items.every((order) => order.customerId === "customer-valentina-rojas"),
    ).toBe(true);
  });

  it("does not reveal another customer's order through detail lookup", async () => {
    const service = new MockOrderService(demoCustomerResolver);

    await expect(service.getCurrentCustomerById("order-2026-0845")).rejects.toMatchObject({
      name: "OrderNotFoundError",
    });
  });
});
