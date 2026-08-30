import type { OrderStatus } from "../domain";

const NEXT_ORDER_STATUS: Readonly<Partial<Record<OrderStatus, OrderStatus>>> = {
  PENDING_PAYMENT: "PAID",
  PAID: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

const CANCELLABLE_ORDER_STATUSES = new Set<OrderStatus>([
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY",
]);

export function getNextOrderStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_ORDER_STATUS[status] ?? null;
}

export function canTransitionOrder(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): boolean {
  return getNextOrderStatus(fromStatus) === toStatus;
}

export function canCancelOrder(status: OrderStatus): boolean {
  return CANCELLABLE_ORDER_STATUSES.has(status);
}
