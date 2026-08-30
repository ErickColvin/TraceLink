import { describe, expect, it } from "vitest";

import { MockSessionContext } from "../../mock-context";
import { MockAuthService } from "../services/mock-auth-service";

describe("MockAuthService", () => {
  it("keeps demo sessions only inside the current service instance", async () => {
    const firstService = new MockAuthService(
      () => new Date("2026-08-29T12:00:00.000Z"),
    );
    const session = await firstService.startDemoSession("customer");

    expect(session).toMatchObject({
      kind: "customer",
      authSource: "demo",
      authenticatedAt: "2026-08-29T12:00:00.000Z",
      customer: { customerId: "customer-valentina-rojas" },
    });
    await expect(firstService.getSession()).resolves.toEqual(session);

    const reloadedService = new MockAuthService();
    await expect(reloadedService.getSession()).resolves.toEqual({
      kind: "anonymous",
    });
  });

  it("does not pretend to authenticate credentials", async () => {
    const service = new MockAuthService();

    await expect(
      service.signIn({
        audience: "customer",
        email: "persona@example.cl",
        password: "not-a-real-password",
      }),
    ).rejects.toMatchObject({ code: "AUTH_NOT_CONFIGURED" });

    await expect(service.getSession()).resolves.toEqual({ kind: "anonymous" });
  });

  it("clears the in-memory session when signing out", async () => {
    const sessionContext = new MockSessionContext();
    const service = new MockAuthService(() => new Date(), sessionContext);
    await service.startDemoSession("customer");

    expect(sessionContext.requireCurrentCustomerId()).toBe(
      "customer-valentina-rojas",
    );

    await service.signOut();

    await expect(service.getSession()).resolves.toEqual({ kind: "anonymous" });
    expect(() => sessionContext.requireCurrentCustomerId()).toThrow(
      /no hay un cliente autenticado/i,
    );
  });

  it("does not retain a customer identity in a staff demo session", async () => {
    const sessionContext = new MockSessionContext();
    const service = new MockAuthService(() => new Date(), sessionContext);
    await service.startDemoSession("customer");

    await service.startDemoSession("staff");

    expect(() => sessionContext.requireCurrentCustomerId()).toThrow(
      /no hay un cliente autenticado/i,
    );
  });
});
