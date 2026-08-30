import type { CurrentCustomerOrderListParams, Order, OrderPage } from "../domain";

export interface OrderService {
  /** The adapter resolves the authenticated customer; callers cannot choose an owner. */
  listCurrentCustomer(params?: CurrentCustomerOrderListParams): Promise<OrderPage>;
  /** Returns not-found for records outside the authenticated customer's scope. */
  getCurrentCustomerById(id: string): Promise<Order>;
}

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el pedido '${id}'.`);
    this.name = "OrderNotFoundError";
  }
}
