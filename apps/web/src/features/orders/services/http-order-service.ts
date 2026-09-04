import { orderPageSchema, orderSchema } from "@tracelink/contracts";

import {
  encodePathSegment,
  HttpClient,
} from "../../../lib/http/http-client";
import type {
  CurrentCustomerOrderListParams,
  Order,
  OrderPage,
} from "../domain";
import type { OrderService } from "./order-service";

export class HttpOrderService implements OrderService {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  listCurrentCustomer(
    params: CurrentCustomerOrderListParams = {},
  ): Promise<OrderPage> {
    return this.#client.request("/me/orders", {
      query: params,
      responseSchema: orderPageSchema,
    });
  }

  getCurrentCustomerById(id: string): Promise<Order> {
    return this.#client.request(`/me/orders/${encodePathSegment(id)}`, {
      responseSchema: orderSchema,
    });
  }
}
