import { delay } from "@/lib/delay";

import { mockStaffOrders } from "../data/mock-staff-orders";
import type {
  CancelStaffOrderInput,
  OrderStatus,
  StaffOrder,
  StaffOrderListParams,
  StaffOrderPage,
  StaffOrderSort,
  TransitionStaffOrderInput,
} from "../domain";
import {
  canCancelOrder,
  canTransitionOrder,
} from "../workflow/order-workflow";
import {
  InvalidOrderCancellationError,
  InvalidOrderTransitionError,
  StaffOrderNotFoundError,
  type StaffOrderService,
} from "./staff-order-service";

const DEFAULT_PAGE_SIZE = 10;

const queuePriority: Readonly<Record<OrderStatus, number>> = {
  PENDING_PAYMENT: 0,
  PAID: 1,
  PREPARING: 2,
  READY: 3,
  CANCELLED: 4,
  REFUNDED: 5,
  COMPLETED: 6,
};

export type MockStaffOrderServiceOptions = Readonly<{
  seed?: readonly StaffOrder[];
  latencyMs?: number;
  now?: () => Date;
}>;

function cloneStaffOrder(order: StaffOrder): StaffOrder {
  return {
    ...order,
    customer: { ...order.customer },
    items: order.items.map((item) => ({ ...item })),
    packageIds: [...order.packageIds],
    statusEvents: order.statusEvents.map((event) => ({ ...event })),
  };
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .trim();
}

function sortStaffOrders(
  orders: StaffOrder[],
  sort: StaffOrderSort,
): StaffOrder[] {
  return orders.sort((left, right) => {
    switch (sort) {
      case "QUEUE": {
        const priorityDifference =
          queuePriority[left.status] - queuePriority[right.status];
        return priorityDifference !== 0
          ? priorityDifference
          : Date.parse(left.createdAt) - Date.parse(right.createdAt);
      }
      case "NEWEST":
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      case "OLDEST":
        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      case "TOTAL_DESC":
        return right.total - left.total;
    }
  });
}

export class MockStaffOrderService implements StaffOrderService {
  private orders: StaffOrder[];
  private readonly latencyMs: number;
  private readonly now: () => Date;

  constructor(options: MockStaffOrderServiceOptions = {}) {
    this.orders = (options.seed ?? mockStaffOrders).map(cloneStaffOrder);
    this.latencyMs = Math.max(0, options.latencyMs ?? 120);
    this.now = options.now ?? (() => new Date());
  }

  async list(params: StaffOrderListParams = {}): Promise<StaffOrderPage> {
    await delay(this.latencyMs);
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const query = normalizeSearch(params.query ?? "");
    const statuses = params.statuses ? new Set(params.statuses) : undefined;
    const paymentStatuses = params.paymentStatuses
      ? new Set(params.paymentStatuses)
      : undefined;
    const fulfillmentMethods = params.fulfillmentMethods
      ? new Set(params.fulfillmentMethods)
      : undefined;
    const fromTime = params.dateFrom
      ? Date.parse(`${params.dateFrom}T00:00:00.000Z`)
      : Number.NEGATIVE_INFINITY;
    const toTime = params.dateTo
      ? Date.parse(`${params.dateTo}T23:59:59.999Z`)
      : Number.POSITIVE_INFINITY;

    const filtered = this.orders
      .filter((order) => {
        if (!query) return true;
        const searchable = normalizeSearch(
          [
            order.orderNumber,
            order.customer.fullName,
            order.customer.email,
            ...order.items.flatMap((item) => [item.name, item.sku]),
          ].join(" "),
        );
        return searchable.includes(query);
      })
      .filter((order) => !statuses || statuses.has(order.status))
      .filter(
        (order) =>
          !paymentStatuses || paymentStatuses.has(order.paymentStatus),
      )
      .filter(
        (order) =>
          !fulfillmentMethods ||
          fulfillmentMethods.has(order.fulfillmentMethod),
      )
      .filter((order) => {
        const createdAt = Date.parse(order.createdAt);
        return createdAt >= fromTime && createdAt <= toTime;
      })
      .map(cloneStaffOrder);
    const sorted = sortStaffOrders(filtered, params.sort ?? "QUEUE");
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

  async getById(id: string): Promise<StaffOrder> {
    await delay(this.latencyMs);
    const order = this.orders.find((candidate) => candidate.id === id);

    if (!order) throw new StaffOrderNotFoundError(id);
    return cloneStaffOrder(order);
  }

  async transitionStatus(
    input: TransitionStaffOrderInput,
  ): Promise<StaffOrder> {
    await delay(this.latencyMs);
    const index = this.orders.findIndex((order) => order.id === input.orderId);
    const current = this.orders[index];

    if (!current) throw new StaffOrderNotFoundError(input.orderId);
    if (!canTransitionOrder(current.status, input.toStatus)) {
      throw new InvalidOrderTransitionError(current.status, input.toStatus);
    }

    const occurredAt = this.now().toISOString();
    const next: StaffOrder = {
      ...cloneStaffOrder(current),
      status: input.toStatus,
      paymentStatus: input.toStatus === "PAID" ? "PAID" : current.paymentStatus,
      updatedAt: occurredAt,
      completedAt:
        input.toStatus === "COMPLETED" ? occurredAt : current.completedAt,
      statusEvents: [
        ...current.statusEvents.map((event) => ({ ...event })),
        {
          id: `${current.id}-event-${current.statusEvents.length + 1}`,
          orderId: current.id,
          fromStatus: current.status,
          toStatus: input.toStatus,
          occurredAt,
          actorId: input.actor.id,
          actorName: input.actor.name,
        },
      ],
    };
    this.orders[index] = next;
    return cloneStaffOrder(next);
  }

  async cancel(input: CancelStaffOrderInput): Promise<StaffOrder> {
    await delay(this.latencyMs);
    const index = this.orders.findIndex((order) => order.id === input.orderId);
    const current = this.orders[index];

    if (!current) throw new StaffOrderNotFoundError(input.orderId);
    if (!canCancelOrder(current.status)) {
      throw new InvalidOrderCancellationError(
        `El pedido en estado ${current.status} ya no se puede cancelar.`,
      );
    }

    const reason = input.reason.trim();
    if (reason.length < 5) {
      throw new InvalidOrderCancellationError(
        "Ingresa un motivo de cancelación de al menos 5 caracteres.",
      );
    }

    const occurredAt = this.now().toISOString();
    const next: StaffOrder = {
      ...cloneStaffOrder(current),
      status: "CANCELLED",
      cancellationReason: reason,
      updatedAt: occurredAt,
      statusEvents: [
        ...current.statusEvents.map((event) => ({ ...event })),
        {
          id: `${current.id}-event-${current.statusEvents.length + 1}`,
          orderId: current.id,
          fromStatus: current.status,
          toStatus: "CANCELLED",
          occurredAt,
          actorId: input.actor.id,
          actorName: input.actor.name,
          reason,
        },
      ],
    };
    this.orders[index] = next;
    return cloneStaffOrder(next);
  }
}
