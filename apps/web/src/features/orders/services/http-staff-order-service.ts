import { staffOrderPageSchema, staffOrderSchema } from "@tracelink/contracts";

import {
  encodePathSegment,
  HttpClient,
  resolveIdempotencyKey,
  type RequestOptions,
} from "../../../lib/http/http-client";
import type {
  CancelStaffOrderInput,
  StaffOrder,
  StaffOrderListParams,
  StaffOrderPage,
  TransitionStaffOrderInput,
} from "../domain";
import type { StaffOrderService } from "./staff-order-service";

export class HttpStaffOrderService implements StaffOrderService {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  list(params: StaffOrderListParams = {}): Promise<StaffOrderPage> {
    return this.#client.request("/staff/orders", {
      query: params,
      responseSchema: staffOrderPageSchema,
    });
  }

  getById(id: string): Promise<StaffOrder> {
    return this.#client.request(`/staff/orders/${encodePathSegment(id)}`, {
      responseSchema: staffOrderSchema,
    });
  }

  transitionStatus(
    input: TransitionStaffOrderInput,
    options?: RequestOptions,
  ): Promise<StaffOrder> {
    return this.#client.request(
      `/staff/orders/${encodePathSegment(input.orderId)}/transitions`,
      {
        method: "POST",
        body: { toStatus: input.toStatus },
        csrf: true,
        idempotencyKey: resolveIdempotencyKey(options),
        responseSchema: staffOrderSchema,
      },
    );
  }

  cancel(
    input: CancelStaffOrderInput,
    options?: RequestOptions,
  ): Promise<StaffOrder> {
    return this.#client.request(
      `/staff/orders/${encodePathSegment(input.orderId)}/cancellation`,
      {
        method: "POST",
        body: { reason: input.reason },
        csrf: true,
        idempotencyKey: resolveIdempotencyKey(options),
        responseSchema: staffOrderSchema,
      },
    );
  }
}
