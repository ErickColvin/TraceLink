import { describe, expect, it } from "vitest";

import { MockRoleService } from "./mock-role-service";
import { MockUserService } from "./mock-user-service";
import { ProtectedRoleError } from "./role-service";

describe("servicios mock de usuarios y roles", () => {
  it("actualiza el estado y rol de una cuenta", async () => {
    const service = new MockUserService();
    const updated = await service.update({ id: "staff-matias-soto", status: "INACTIVE", roleId: "role-operations" });
    expect(updated).toMatchObject({ status: "INACTIVE", roleId: "role-operations" });
    expect(await service.getById(updated.id)).not.toBe(updated);
  });

  it("actualiza permisos tipados sin duplicados", async () => {
    const service = new MockRoleService();
    const updated = await service.updatePermissions({ id: "role-sales", permissions: ["orders.view", "orders.view", "customers.view"] });
    expect(updated.permissions).toEqual(["orders.view", "customers.view"]);
  });

  it("protege los permisos de superadministración", async () => {
    const service = new MockRoleService();
    await expect(service.updatePermissions({ id: "role-super-admin", permissions: [] })).rejects.toBeInstanceOf(ProtectedRoleError);
  });
});
