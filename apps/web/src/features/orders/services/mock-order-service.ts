import { delay } from "@/lib/delay";

import {
  mockSessionContext,
  type CurrentCustomerResolver,
} from "../../mock-context";
import { mockOrders } from "../data/mock-orders";
import type {
  CurrentCustomerOrderListParams,
  Order,
  OrderPage,
  OrderSort,
} from "../domain";
import { OrderNotFoundError, type OrderService } from "./order-service";

const DEFAULT_PAGE_SIZE = 10;

function cloneOrder(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    packageIds: [...order.packageIds],
  };
}

function sortOrders(orders: Order[], sort: OrderSort): Order[] {
  return orders.sort((left, right) => {
    switch (sort) {
      case "NEWEST":
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      case "OLDEST":
        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      case "TOTAL_DESC":
        return right.total - left.total;
      case "TOTAL_ASC":
        return left.total - right.total;
    }
  });
}

export class MockOrderService implements OrderService {
  constructor(
    private readonly customerResolver: CurrentCustomerResolver = mockSessionContext,
  ) {}

  async listCurrentCustomer(params: CurrentCustomerOrderListParams = {}): Promise<OrderPage> {
    const currentCustomerId = this.customerResolver.requireCurrentCustomerId();
    await delay(160);

    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const allowedStatuses = params.statuses ? new Set(params.statuses) : undefined;
    const filtered = mockOrders
      .filter((order) => order.customerId === currentCustomerId)
      .filter((order) => !allowedStatuses || allowedStatuses.has(order.status))
      .map(cloneOrder);
    const sorted = sortOrders(filtered, params.sort ?? "NEWEST");
    const totalItems = sorted.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async getCurrentCustomerById(id: string): Promise<Order> {
    const currentCustomerId = this.customerResolver.requireCurrentCustomerId();
    await delay(130);
    const order = mockOrders.find(
      (candidate) =>
        candidate.id === id && candidate.customerId === currentCustomerId,
    );

    if (!order) throw new OrderNotFoundError(id);
    return cloneOrder(order);
  }
}
