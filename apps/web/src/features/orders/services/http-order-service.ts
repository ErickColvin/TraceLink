import {
  customerOrderCancellationResponseSchema,
  orderPageSchema,
  orderSchema,
  retryPaymentResponseSchema,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  HttpClient,
  resolveIdempotencyKey,
  type RequestOptions,
} from "../../../lib/http/http-client";
import type {
  CancelCustomerOrderResult,
  CurrentCustomerOrderListParams,
  Order,
  OrderPage,
  RetryCustomerPaymentResult,
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

  retryPayment(
    id: string,
    options?: RequestOptions,
  ): Promise<RetryCustomerPaymentResult> {
    return this.#client.request(
      `/me/orders/${encodePathSegment(id)}/payment-attempts`,
      {
        method: "POST",
        body: {},
        csrf: true,
        idempotencyKey: resolveIdempotencyKey(options),
        responseSchema: retryPaymentResponseSchema,
      },
    );
  }

  cancel(
    id: string,
    reason: string,
    options?: RequestOptions,
  ): Promise<CancelCustomerOrderResult> {
    return this.#client.request(
      `/me/orders/${encodePathSegment(id)}/cancellation`,
      {
        method: "POST",
        body: { reason },
        csrf: true,
        idempotencyKey: resolveIdempotencyKey(options),
        responseSchema: customerOrderCancellationResponseSchema,
      },
    );
  }
}
