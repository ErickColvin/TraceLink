import { describe, expect, it } from "vitest";

import { DEMO_CUSTOMER_ID, type CurrentCustomerResolver } from "../../mock-context";
import { MockPackageService } from "./mock-package-service";

const demoCustomerResolver: CurrentCustomerResolver = {
  requireCurrentCustomerId: () => DEMO_CUSTOMER_ID,
};

describe("MockPackageService", () => {
  it("returns a chronological status timeline for the current customer", async () => {
    const service = new MockPackageService(demoCustomerResolver);

    const customerPackage = await service.getCurrentCustomerById("package-ch-41028");

    expect(customerPackage.events.map((event) => event.status)).toEqual([
      "EXPECTED",
      "RECEIVED",
      "STORED",
      "READY_FOR_PICKUP",
    ]);
    expect(customerPackage.events.every((event, index, events) => {
      const previous = events[index - 1];
      return !previous || Date.parse(previous.occurredAt) <= Date.parse(event.occurredAt);
    })).toBe(true);
  });

  it("does not reveal another customer's package through detail lookup", async () => {
    const service = new MockPackageService(demoCustomerResolver);

    await expect(service.getCurrentCustomerById("package-ch-41052")).rejects.toMatchObject({
      name: "PackageNotFoundError",
    });
  });

  it("searches package contents as well as the tracking code", async () => {
    const service = new MockPackageService(demoCustomerResolver);

    const result = await service.listCurrentCustomer({ search: "Pescado" });

    expect(result.items.map((item) => item.id)).toEqual(["package-ch-40991"]);
  });
});
