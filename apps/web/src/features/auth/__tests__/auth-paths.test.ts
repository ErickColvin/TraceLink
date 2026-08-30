import { describe, expect, it } from "vitest";

import type { CustomerSession, StaffSession } from "../model/auth";
import {
  CUSTOMER_HOME_PATH,
  STAFF_HOME_PATH,
  resolvePostAuthPath,
  sanitizeInternalPath,
} from "../routing/auth-paths";

const customerSession: CustomerSession = {
  kind: "customer",
  authSource: "demo",
  authenticatedAt: "2026-08-29T12:00:00.000Z",
  customer: {
    id: "account-valentina-rojas",
    customerId: "customer-valentina-rojas",
    firstName: "Valentina",
    lastName: "Rojas",
    email: "valentina.rojas@example.cl",
  },
};

const staffSession: StaffSession = {
  kind: "staff",
  authSource: "demo",
  authenticatedAt: "2026-08-29T12:00:00.000Z",
  staff: {
    id: "staff-camila-torres",
    firstName: "Camila",
    lastName: "Torres",
    email: "camila.torres@example.cl",
    role: "administrator",
    roleLabel: "Administración",
  },
  permissions: ["orders.view"],
};

describe("authentication return paths", () => {
  it.each([
    "https://example.com/account",
    "//example.com/account",
    "/%2F%2Fexample.com/account",
    "/%5C%5Cexample.com/account",
    "/app/%00settings",
    "%E0%A4%A",
  ])("rejects unsafe path %s", (path) => {
    expect(sanitizeInternalPath(path)).toBeNull();
  });

  it("preserves a safe local path including search and hash", () => {
    const path = "/mi-cuenta/paquetes?estado=recibido#timeline";
    expect(sanitizeInternalPath(path)).toBe(path);
  });

  it("does not redirect a customer into the staff portal", () => {
    expect(resolvePostAuthPath(customerSession, "/app/users")).toBe(
      CUSTOMER_HOME_PATH,
    );
  });

  it("does not redirect a staff member into a customer account", () => {
    expect(resolvePostAuthPath(staffSession, "/mi-cuenta/pedidos")).toBe(
      STAFF_HOME_PATH,
    );
  });
});
