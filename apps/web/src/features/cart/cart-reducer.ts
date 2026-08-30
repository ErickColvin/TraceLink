import type {
  CartItem,
  CartProductInput,
  CartState,
} from "@/features/cart/domain/cart";

export type CartAction =
  | { type: "ADD"; product: CartProductInput; quantity: number }
  | { type: "SET_QUANTITY"; productId: string; quantity: number }
  | { type: "REMOVE"; productId: string }
  | { type: "CLEAR" };

export const initialCartState: CartState = { items: [] };

function clampQuantity(quantity: number, availableStock: number): number {
  return Math.max(1, Math.min(Math.floor(quantity), availableStock));
}

function toCartItem(product: CartProductInput, quantity: number): CartItem {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    unitPrice: product.salePrice,
    quantity: clampQuantity(quantity, product.availableStock),
    availableStock: product.availableStock,
    imageUrl: product.imageUrl,
  };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      if (action.product.availableStock <= 0) {
        return state;
      }

      const existing = state.items.find(
        (item) => item.productId === action.product.id,
      );

      if (!existing) {
        return {
          items: [...state.items, toCartItem(action.product, action.quantity)],
        };
      }

      return {
        items: state.items.map((item) =>
          item.productId === action.product.id
            ? {
                ...item,
                quantity: clampQuantity(
                  item.quantity + action.quantity,
                  item.availableStock,
                ),
              }
            : item,
        ),
      };
    }
    case "SET_QUANTITY":
      if (action.quantity <= 0) {
        return {
          items: state.items.filter(
            (item) => item.productId !== action.productId,
          ),
        };
      }

      return {
        items: state.items.map((item) =>
          item.productId === action.productId
            ? {
                ...item,
                quantity: clampQuantity(action.quantity, item.availableStock),
              }
            : item,
        ),
      };
    case "REMOVE":
      return {
        items: state.items.filter(
          (item) => item.productId !== action.productId,
        ),
      };
    case "CLEAR":
      return initialCartState;
  }
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotal(items: CartItem[]): number {
  return items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0,
  );
}

