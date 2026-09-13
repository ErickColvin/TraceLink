import { describe, expect, it } from "vitest";

import { packageReceiptSchema } from "./package-receipt-schema";

const validValues = {
  customerId: "customer-valentina-rojas",
  trackingCode: "CHM-50010-CL",
  carrier: "Blue Express",
  orderId: "",
  contentsDescription: "Productos refrigerados",
  itemCount: 2,
  requiresColdStorage: true,
  storageLocation: "Cámara fría · Módulo F-07",
  notes: "Validar temperatura al almacenar.",
  expectedAt: "",
  receivedAt: "2026-08-30T10:30",
  weightKg: 2.4,
};

describe("packageReceiptSchema", () => {
  it("acepta una recepción completa", () => {
    expect(packageReceiptSchema.safeParse(validValues).success).toBe(true);
  });

  it("rechaza cliente libre, código inválido y cantidad vacía", () => {
    const result = packageReceiptSchema.safeParse({
      ...validValues,
      customerId: "",
      trackingCode: "@@",
      carrier: "",
      itemCount: 0,
      storageLocation: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.customerId).toBeDefined();
    expect(result.error.flatten().fieldErrors.trackingCode).toBeDefined();
    expect(result.error.flatten().fieldErrors.carrier).toBeDefined();
    expect(result.error.flatten().fieldErrors.itemCount).toBeDefined();
    expect(result.error.flatten().fieldErrors.storageLocation).toBeDefined();
  });
});
