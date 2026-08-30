import { createContext } from "react";
import type { CartItem, CartProductInput } from "@/features/cart/domain/cart";

export type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  total: number;
  addItem: (product: CartProductInput, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue | null>(null);

