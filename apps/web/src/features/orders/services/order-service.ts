import type { RequestOptions } from "../../../lib/http/http-client";
import type {
  CancelCustomerOrderResult,
  CurrentCustomerOrderListParams,
  Order,
  OrderPage,
  RetryCustomerPaymentResult,
} from "../domain";

export interface OrderService {
  /** The adapter resolves the authenticated customer; callers cannot choose an owner. */
  listCurrentCustomer(params?: CurrentCustomerOrderListParams): Promise<OrderPage>;
  /** Returns not-found for records outside the authenticated customer's scope. */
  getCurrentCustomerById(id: string): Promise<Order>;
  retryPayment(id: string, options?: RequestOptions): Promise<RetryCustomerPaymentResult>;
  cancel(
    id: string,
    reason: string,
    options?: RequestOptions,
  ): Promise<CancelCustomerOrderResult>;
}

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el pedido '${id}'.`);
    this.name = "OrderNotFoundError";
  }
}
