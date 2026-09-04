import type { OrderStatus, OrderTransitionTarget } from "@tracelink/contracts";

const NEXT_ORDER_STATUS = {
  PENDING_PAYMENT: "PAID",
  PAID: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
} as const satisfies Readonly<Partial<Record<OrderStatus, OrderTransitionTarget>>>;

const CANCELLABLE_ORDER_STATUSES = new Set<OrderStatus>([
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY",
]);

export function getNextOrderStatus(
  status: OrderStatus,
): OrderTransitionTarget | null {
  return NEXT_ORDER_STATUS[status as keyof typeof NEXT_ORDER_STATUS] ?? null;
}

export function canTransitionOrder(
  fromStatus: OrderStatus,
  toStatus: OrderTransitionTarget,
): boolean {
  return getNextOrderStatus(fromStatus) === toStatus;
}

export function canCancelOrder(status: OrderStatus): boolean {
  return CANCELLABLE_ORDER_STATUSES.has(status);
}
