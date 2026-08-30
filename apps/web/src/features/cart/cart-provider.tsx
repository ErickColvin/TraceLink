import {
  useMemo,
  useReducer,
  type PropsWithChildren,
} from "react";
import {
  cartReducer,
  getCartItemCount,
  getCartTotal,
  initialCartState,
} from "@/features/cart/cart-reducer";
import { CartContext, type CartContextValue } from "@/features/cart/cart-context";

export function CartProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      itemCount: getCartItemCount(state.items),
      total: getCartTotal(state.items),
      addItem: (product, quantity = 1) => {
        dispatch({ type: "ADD", product, quantity });
      },
      setQuantity: (productId, quantity) => {
        dispatch({ type: "SET_QUANTITY", productId, quantity });
      },
      removeItem: (productId) => {
        dispatch({ type: "REMOVE", productId });
      },
      clearCart: () => {
        dispatch({ type: "CLEAR" });
      },
    }),
    [state.items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
