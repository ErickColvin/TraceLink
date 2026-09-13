import { describe, expect, it } from "vitest";

import {
  canTransitionPackage,
  getAllowedPackageTransitions,
  getNextStandardPackageStatus,
} from "./package-workflow";

describe("package workflow", () => {
  it("define la secuencia operativa estándar", () => {
    expect(getNextStandardPackageStatus("EXPECTED")).toBe("RECEIVED");
    expect(getNextStandardPackageStatus("RECEIVED")).toBe("STORED");
    expect(getNextStandardPackageStatus("STORED")).toBe("READY_FOR_PICKUP");
    expect(getNextStandardPackageStatus("READY_FOR_PICKUP")).toBe("PICKED_UP");
    expect(getNextStandardPackageStatus("PICKED_UP")).toBeNull();
  });

  it("permite excepciones declaradas y bloquea saltos", () => {
    expect(canTransitionPackage("EXPECTED", "STORED")).toBe(false);
    expect(canTransitionPackage("RECEIVED", "INCIDENT")).toBe(true);
    expect(canTransitionPackage("PICKED_UP", "RETURNED")).toBe(false);
    expect(getAllowedPackageTransitions("INCIDENT")).toEqual([
      "STORED",
      "RETURNED",
      "LOST",
    ]);
  });
});
