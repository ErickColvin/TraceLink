import { tenantBrand } from "@/app/config/brand";

import type {
  Order,
  OrderStatus,
  OrderStatusEvent,
  StaffOrder,
  StaffOrderCustomer,
} from "../domain";
import { mockOrders } from "./mock-orders";

const staffOrderCustomers: Readonly<Record<string, StaffOrderCustomer>> = {
  "customer-valentina-rojas": {
    id: "customer-valentina-rojas",
    fullName: "Valentina Rojas",
    email: "valentina.rojas@example.cl",
    phone: "+56 9 6123 4587",
  },
  "customer-matias-soto": {
    id: "customer-matias-soto",
    fullName: "MatÃ­as Soto",
    email: "matias.soto@example.cl",
    phone: "+56 9 7318 2044",
  },
  "customer-camila-fernandez": {
    id: "customer-camila-fernandez",
    fullName: "Camila FernÃ¡ndez",
    email: "camila.fernandez@example.cl",
    phone: "+56 9 8455 9210",
  },
};

const pendingOrder: Order = {
  id: "order-2026-0849",
  orderNumber: "CH-2026-0849",
  customerId: "customer-camila-fernandez",
  status: "PENDING_PAYMENT",
  paymentStatus: "PENDING",
  fulfillmentMethod: "PICKUP",
  items: [
    {
      id: "order-item-0849-1",
      productId: "product-berries",
      sku: "CON-FRU-004",
      name: "Mix de berries congelados 500 g",
      quantity: 2,
      unitPrice: 5490,
      lineTotal: 10980,
    },
  ],
  subtotal: 10980,
  discountTotal: 0,
  deliveryFee: 0,
  total: 10980,
  createdAt: "2026-08-29T15:20:00.000Z",
  updatedAt: "2026-08-29T15:20:00.000Z",
  pickupLocation: `Sucursal ${tenantBrand.name} Huechuraba`,
  packageIds: [],
};

const statusPaths: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ["PENDING_PAYMENT"],
  PAID: ["PENDING_PAYMENT", "PAID"],
  PREPARING: ["PENDING_PAYMENT", "PAID", "PREPARING"],
  READY: ["PENDING_PAYMENT", "PAID", "PREPARING", "READY"],
  COMPLETED: ["PENDING_PAYMENT", "PAID", "PREPARING", "READY", "COMPLETED"],
  CANCELLED: ["PENDING_PAYMENT", "CANCELLED"],
  REFUNDED: ["PENDING_PAYMENT", "PAID", "CANCELLED", "REFUNDED"],
};

function buildInitialEvents(order: Order): OrderStatusEvent[] {
  const path = statusPaths[order.status];
  const createdAt = Date.parse(order.createdAt);
  const updatedAt = Math.max(createdAt, Date.parse(order.updatedAt));
  const interval = path.length > 1 ? (updatedAt - createdAt) / (path.length - 1) : 0;

  return path.map((status, index) => ({
    id: `${order.id}-event-${index + 1}`,
    orderId: order.id,
    fromStatus: index === 0 ? null : (path[index - 1] ?? null),
    toStatus: status,
    occurredAt: new Date(createdAt + interval * index).toISOString(),
    actorId: index === 0 ? "system-checkout" : "staff-demo",
    actorName: index === 0 ? "Checkout de demostraciÃ³n" : "Equipo CH Market",
    reason:
      status === "CANCELLED"
        ? "Solicitud registrada por el cliente."
        : undefined,
  }));
}

export const mockStaffOrders = [...mockOrders, pendingOrder].map((order) => {
  const customer = staffOrderCustomers[order.customerId];

  if (!customer) {
    throw new Error(`Falta el cliente operativo del pedido '${order.id}'.`);
  }

  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    packageIds: [...order.packageIds],
    customer: { ...customer },
    statusEvents: buildInitialEvents(order),
    cancellationReason:
      order.status === "CANCELLED"
        ? "Solicitud registrada por el cliente."
        : undefined,
  } satisfies StaffOrder;
}) satisfies StaffOrder[];
