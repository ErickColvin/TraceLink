import { describe, expect, it } from "vitest";

import { checkoutSchema } from "./checkout-schema";

describe("checkoutSchema", () => {
  it("acepta notas opcionales para retiro autenticado", () => {
    expect(checkoutSchema.safeParse({ notes: "" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ notes: "Retiro por la tarde" }).success).toBe(true);
  });

  it("rechaza campos de despacho o contacto en checkout real", () => {
    expect(checkoutSchema.safeParse({
      notes: "",
      deliveryMethod: "DELIVERY",
    }).success).toBe(false);
  });
});
