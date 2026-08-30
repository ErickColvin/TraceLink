export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type FulfillmentMethod = "PICKUP" | "DELIVERY";

export interface OrderItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentMethod: FulfillmentMethod;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  estimatedReadyAt?: string;
  completedAt?: string;
  pickupLocation?: string;
  packageIds: string[];
}

export const ORDER_SORT_OPTIONS = ["NEWEST", "OLDEST", "TOTAL_DESC", "TOTAL_ASC"] as const;

export type OrderSort = (typeof ORDER_SORT_OPTIONS)[number];

export interface CurrentCustomerOrderListParams {
  statuses?: OrderStatus[];
  sort?: OrderSort;
  page?: number;
  pageSize?: number;
}

export interface OrderPage {
  items: Order[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
