import { PERMISSIONS, ROLE_CODES } from "@tracelink/contracts";
import { describe, expect, it } from "vitest";

import {
  ROLE_CATALOG,
  assertRbacCatalog,
  getRoleCatalogEntry,
} from "../../src/modules/roles/rbac-catalog.js";

describe("RBAC catalog", () => {
  it("defines the six roles with only known, non-duplicated permissions", () => {
    expect(assertRbacCatalog).not.toThrow();
    expect(ROLE_CATALOG.map((role) => role.code)).toEqual(ROLE_CODES);
  });

  it("keeps SUPER_ADMIN authoritative over all 19 permissions", () => {
    expect(getRoleCatalogEntry("SUPER_ADMIN").permissions).toEqual(PERMISSIONS);
  });

  it("does not grant access management to operational roles", () => {
    for (const code of ["INVENTORY", "OPERATIONS", "SALES", "WAREHOUSE"] as const) {
      expect(getRoleCatalogEntry(code).permissions).not.toContain("users.manage");
      expect(getRoleCatalogEntry(code).permissions).not.toContain("settings.manage");
    }
  });
});

