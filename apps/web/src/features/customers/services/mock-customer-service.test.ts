import { describe, expect, it } from "vitest";

import { MockSessionContext } from "../../mock-context";
import type {
  Customer,
  CustomerProfileInput,
  StaffCustomerUpdateInput,
} from "../domain";
import type {
  CustomerSelfService,
  StaffCustomerService,
} from "./customer-service";
import {
  CustomerConflictError,
  CustomerNotFoundError,
} from "./customer-service";
import { MockCustomerService } from "./mock-customer-service";

const customers = [
  {
    id: "customer-ana",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.cl",
    phone: "+56 9 1111 2222",
    status: "ACTIVE",
    createdAt: "2026-01-01T12:00:00.000Z",
  },
  {
    id: "customer-bruno",
    firstName: "Bruno",
    lastName: "Soto",
    email: "bruno@example.cl",
    phone: "+56 9 3333 4444",
    status: "ACTIVE",
    createdAt: "2026-02-01T12:00:00.000Z",
  },
] satisfies readonly Customer[];

const anaUpdate: CustomerProfileInput = {
  firstName: "Ana María",
  lastName: "Pérez",
  email: "ANA.NUEVA@EXAMPLE.CL",
  phone: "+56 9 9999 0000",
  address: {
    line1: "Calle Uno 123",
    commune: "Providencia",
    city: "Santiago",
    region: "Región Metropolitana",
  },
};

function createService(session = new MockSessionContext()) {
  const service = new MockCustomerService(session, {
    customers,
    orders: [],
    packages: [],
    latencyMs: 0,
    now: () => new Date("2026-08-30T15:00:00.000Z"),
  });
  return { service, session };
}

describe("MockCustomerService", () => {
  it.each([
    ["ana pérez", "customer-ana"],
    ["BRUNO@EXAMPLE.CL", "customer-bruno"],
    ["1111 2222", "customer-ana"],
  ])("searches customers by name, email or phone: %s", async (search, expectedId) => {
    const { service } = createService();

    const result = await service.list({ search });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(expectedId);
  });

  it("updates staff data without using the current-customer contract", async () => {
    const { service } = createService();
    const staffService: StaffCustomerService = service;
    const input: StaffCustomerUpdateInput = {
      ...anaUpdate,
      status: "INACTIVE",
    };

    const updated = await staffService.update("customer-ana", input);

    expect(updated.customer).toMatchObject({
      id: "customer-ana",
      firstName: "Ana María",
      email: "ana.nueva@example.cl",
      status: "INACTIVE",
    });
    expect(updated.activity[0]).toMatchObject({
      actor: "STAFF",
      kind: "PROFILE_UPDATED",
    });
    expect((await staffService.getById("customer-bruno")).customer.email).toBe(
      "bruno@example.cl",
    );
  });

  it("resolves self-service mutations exclusively from the authenticated identity", async () => {
    const { service, session } = createService();
    const selfService: CustomerSelfService = service;
    const staffService: StaffCustomerService = service;
    session.setCurrentCustomer("customer-ana");

    const updated = await selfService.updateCurrent(anaUpdate);

    expect(updated.id).toBe("customer-ana");
    expect(updated.email).toBe("ana.nueva@example.cl");
    session.setCurrentCustomer("customer-bruno");
    await expect(selfService.getCurrent()).resolves.toMatchObject({
      id: "customer-bruno",
      email: "bruno@example.cl",
    });
    await expect(staffService.getById("customer-ana")).resolves.toMatchObject({
      customer: { email: "ana.nueva@example.cl" },
    });
  });

  it("does not expose a different record when the session identity is unknown", async () => {
    const { service, session } = createService();
    const selfService: CustomerSelfService = service;
    session.setCurrentCustomer("customer-does-not-exist");

    await expect(selfService.getCurrent()).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
    await expect(selfService.updateCurrent(anaUpdate)).rejects.toBeInstanceOf(
      CustomerNotFoundError,
    );
  });

  it("rejects an email already assigned to another customer", async () => {
    const { service } = createService();

    await expect(
      service.update("customer-ana", {
        ...anaUpdate,
        email: " BRUNO@EXAMPLE.CL ",
        status: "ACTIVE",
      }),
    ).rejects.toBeInstanceOf(CustomerConflictError);
  });
});
