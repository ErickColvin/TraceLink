import type {
  CurrentCustomerOrderListParams,
  Order,
  OrderCancellationRequest,
  OrderPage,
  OrderTransitionRequest,
  StaffOrder,
  StaffOrderListParams,
  StaffOrderPage,
} from "@tracelink/contracts";
import { staffOrderSchema } from "@tracelink/contracts";

import type { PostgresDatabase } from "../../database/index.js";
import {
  IdempotencyService,
  type IdempotencyExecution,
} from "../../shared/idempotency/idempotency.js";
import { PostgresOrderRepository } from "./order-repository.js";

export class OrderService {
  readonly #repository: PostgresOrderRepository;
  readonly #idempotency: IdempotencyService;

  constructor(database: PostgresDatabase, idempotencySecret: string) {
    this.#repository = new PostgresOrderRepository(database);
    this.#idempotency = new IdempotencyService(database, idempotencySecret);
  }

  listCurrentCustomer(
    organizationId: string,
    customerId: string,
    params: CurrentCustomerOrderListParams,
  ): Promise<OrderPage> {
    return this.#repository.listCurrentCustomer(
      organizationId,
      customerId,
      params,
    );
  }

  getCurrentCustomerById(
    organizationId: string,
    customerId: string,
    orderId: string,
  ): Promise<Order> {
    return this.#repository.getCurrentCustomerById(
      organizationId,
      customerId,
      orderId,
    );
  }

  listStaff(
    organizationId: string,
    params: StaffOrderListParams,
  ): Promise<StaffOrderPage> {
    return this.#repository.listStaff(organizationId, params);
  }

  getStaffById(
    organizationId: string,
    orderId: string,
  ): Promise<StaffOrder> {
    return this.#repository.getStaffById(organizationId, orderId);
  }

  transitionStatus(options: Readonly<{
    organizationId: string;
    orderId: string;
    actorUserId: string;
    input: OrderTransitionRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<IdempotencyExecution<StaffOrder>> {
    return this.#idempotency.execute({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      key: options.idempotencyKey,
      operation: "order.status.transition",
      payload: { orderId: options.orderId, ...options.input },
      requestId: options.requestId,
      responseSchema: staffOrderSchema,
      mutation: async (executor) => {
        const body = await this.#repository.transitionStatus(executor, options);
        return {
          statusCode: 200,
          body,
          resourceType: "Order",
          resourceId: body.id,
        };
      },
    });
  }

  cancel(options: Readonly<{
    organizationId: string;
    orderId: string;
    actorUserId: string;
    input: OrderCancellationRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<IdempotencyExecution<StaffOrder>> {
    return this.#idempotency.execute({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      key: options.idempotencyKey,
      operation: "order.cancel",
      payload: { orderId: options.orderId, ...options.input },
      requestId: options.requestId,
      responseSchema: staffOrderSchema,
      mutation: async (executor) => {
        const body = await this.#repository.cancel(executor, options);
        return {
          statusCode: 200,
          body,
          resourceType: "Order",
          resourceId: body.id,
        };
      },
    });
  }
}
