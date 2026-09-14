import { describe, expect, it } from "vitest";

import type { CheckoutInput } from "../domain";
import { EmptyCheckoutError } from "./checkout-service";
import { MockCheckoutService } from "./mock-checkout-service";

const checkoutInput: CheckoutInput = {
  contact: {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.cl",
    phone: "+56 9 1234 5678",
  },
  deliveryMethod: "PICKUP",
  items: [{
    productId: "product-1",
    slug: "producto-demo",
    name: "Producto demo",
    unitPrice: 3_500,
    quantity: 2,
    availableStock: 4,
  }],
  total: 7_000,
};

describe("MockCheckoutService", () => {
  it("prepara un recibo simulado sin alterar los ítems", async () => {
    const service = new MockCheckoutService();
    const receipt = await service.submit(checkoutInput);

    expect(receipt).toMatchObject({
      itemCount: 2,
      total: 7_000,
      deliveryMethod: "PICKUP",
    });
    expect(receipt.orderCode).toMatch(/^CH-/);
    expect(checkoutInput.items[0]?.quantity).toBe(2);
  });

  it("rechaza una simulación sin productos", async () => {
    const service = new MockCheckoutService();
    await expect(service.submit({ ...checkoutInput, items: [] })).rejects.toBeInstanceOf(EmptyCheckoutError);
  });
});
