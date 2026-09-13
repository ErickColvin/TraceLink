import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  generatePickupCode,
  hashPickupCode,
  verifyPickupCode,
} from "../../src/modules/packages/pickup-code.js";
import {
  canTransitionPackage,
  packageTransitionDescription,
} from "../../src/modules/packages/package-workflow.js";

describe("package state machine", () => {
  it("permite el flujo normal sin habilitar PICKED_UP genérico", () => {
    expect(canTransitionPackage("EXPECTED", "RECEIVED")).toBe(true);
    expect(canTransitionPackage("RECEIVED", "STORED")).toBe(true);
    expect(canTransitionPackage("STORED", "READY_FOR_PICKUP")).toBe(true);
    expect(canTransitionPackage("READY_FOR_PICKUP", "RETURNED")).toBe(true);
    expect(canTransitionPackage("RECEIVED", "READY_FOR_PICKUP")).toBe(false);
    expect(canTransitionPackage("PICKED_UP", "INCIDENT")).toBe(false);
    expect(packageTransitionDescription("PICKED_UP")).toContain("entregado");
  });
});

describe("package pickup credentials", () => {
  it("genera credenciales aleatorias y verifica un hash ligado al tenant/paquete", () => {
    const secret = "pickup-test-secret-with-at-least-32-characters";
    const organizationId = randomUUID();
    const packageId = randomUUID();
    const code = generatePickupCode();
    const secondCode = generatePickupCode();
    const hash = hashPickupCode(secret, organizationId, packageId, code);

    expect(code).toHaveLength(16);
    expect(secondCode).not.toBe(code);
    expect(hash).toHaveLength(32);
    expect(verifyPickupCode(secret, organizationId, packageId, code, hash)).toBe(true);
    expect(verifyPickupCode(secret, organizationId, packageId, "incorrecto", hash)).toBe(false);
    expect(verifyPickupCode(secret, organizationId, randomUUID(), code, hash)).toBe(false);
  });
});
