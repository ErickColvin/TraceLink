import { delay } from "@/lib/delay";

import {
  mockSessionContext,
  type CurrentCustomerResolver,
} from "../../mock-context";
import { mockOrders } from "../data/mock-orders";
import type {
  CancelCustomerOrderResult,
  CurrentCustomerOrderListParams,
  Order,
  OrderPage,
  OrderSort,
  RetryCustomerPaymentResult,
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

  async retryPayment(id: string): Promise<RetryCustomerPaymentResult> {
    await delay(160);
    const order = await this.getCurrentCustomerById(id);

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentMethod: "PICKUP",
        subtotal: order.subtotal,
        discountTotal: 0,
        deliveryFee: 0,
        total: order.total,
        createdAt: order.createdAt,
      },
      payment: {
        id: `${order.id}-payment`,
        orderId: order.id,
        provider: "FAKE",
        status: "PENDING",
        amount: order.total,
        currency: "CLP",
        providerExternalReference: `${order.id}-mock`,
        createdAt: order.createdAt,
        updatedAt: new Date().toISOString(),
      },
      attempt: {
        id: `${order.id}-attempt-retry`,
        paymentId: `${order.id}-payment`,
        attemptNumber: 2,
        status: "PENDING",
        checkoutUrl: "/checkout/resultado?status=pending",
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      checkoutUrl: "/checkout/resultado?status=pending",
      reservationExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  async cancel(id: string): Promise<CancelCustomerOrderResult> {
    await delay(120);
    const order = await this.getCurrentCustomerById(id);
    return { orderId: order.id, status: "CANCELLED", paymentStatus: "CANCELLED" };
  }
}
