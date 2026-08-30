import { useContext } from "react";
import { CartContext, type CartContextValue } from "@/features/cart/cart-context";

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart debe utilizarse dentro de CartProvider");
  }

  return context;
}

