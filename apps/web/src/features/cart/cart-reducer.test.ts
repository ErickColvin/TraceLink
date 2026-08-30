import { describe, expect, it } from "vitest";
import {
  cartReducer,
  getCartItemCount,
  getCartTotal,
  initialCartState,
} from "@/features/cart/cart-reducer";

const product = {
  id: "product-1",
  slug: "salmon-porcionado",
  name: "Salmón porcionado",
  salePrice: 8990,
  availableStock: 4,
};

describe("cartReducer", () => {
  it("acumula cantidades sin superar el stock disponible", () => {
    const firstState = cartReducer(initialCartState, {
      type: "ADD",
      product,
      quantity: 3,
    });
    const finalState = cartReducer(firstState, {
      type: "ADD",
      product,
      quantity: 3,
    });

    expect(finalState.items[0]?.quantity).toBe(4);
    expect(getCartItemCount(finalState.items)).toBe(4);
    expect(getCartTotal(finalState.items)).toBe(35_960);
  });

  it("elimina un ítem al establecer una cantidad no positiva", () => {
    const withItem = cartReducer(initialCartState, {
      type: "ADD",
      product,
      quantity: 1,
    });

    expect(
      cartReducer(withItem, {
        type: "SET_QUANTITY",
        productId: product.id,
        quantity: 0,
      }).items,
    ).toEqual([]);
  });
});

