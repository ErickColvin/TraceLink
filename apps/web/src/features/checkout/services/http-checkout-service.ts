import {
  checkoutResponseSchema,
  type CheckoutResponse,
} from "@tracelink/contracts";

import {
  HttpClient,
  resolveIdempotencyKey,
  type RequestOptions,
} from "@/lib/http/http-client";

import type { CheckoutInput } from "../domain";
import type { CheckoutService } from "./checkout-service";

export class HttpCheckoutService implements CheckoutService {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  submit(
    input: CheckoutInput,
    options?: RequestOptions,
  ): Promise<CheckoutResponse> {
    return this.#client.request("/checkout", {
      method: "POST",
      csrf: true,
      idempotencyKey: resolveIdempotencyKey(options),
      body: {
        fulfillmentMethod: "PICKUP",
        notes: input.notes,
        items: input.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
      responseSchema: checkoutResponseSchema,
    });
  }
}
