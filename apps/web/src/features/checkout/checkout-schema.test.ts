import { describe, expect, it } from "vitest";

import { checkoutSchema } from "./checkout-schema";

const validValues = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.cl",
  phone: "+56 9 1234 5678",
  deliveryMethod: "PICKUP" as const,
  line1: "",
  commune: "",
  city: "",
  region: "",
  notes: "",
};

describe("checkoutSchema", () => {
  it("permite retiro sin dirección", () => {
    expect(checkoutSchema.safeParse(validValues).success).toBe(true);
  });

  it("exige una dirección completa para despacho", () => {
    const result = checkoutSchema.safeParse({
      ...validValues,
      deliveryMethod: "DELIVERY",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
        "line1",
        "commune",
        "city",
        "region",
      ]);
    }
  });
});
