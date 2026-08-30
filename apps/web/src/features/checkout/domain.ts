import type { CartItem } from "@/features/cart/domain/cart";

export const DELIVERY_METHODS = ["PICKUP", "DELIVERY"] as const;

export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export type CheckoutContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type CheckoutAddress = {
  line1: string;
  commune: string;
  city: string;
  region: string;
};

export type CheckoutInput = {
  contact: CheckoutContact;
  deliveryMethod: DeliveryMethod;
  address?: CheckoutAddress;
  notes?: string;
  items: CartItem[];
  total: number;
};

export type CheckoutReceipt = {
  orderCode: string;
  receivedAt: string;
  itemCount: number;
  total: number;
  deliveryMethod: DeliveryMethod;
};

export type CheckoutSubmissionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; receipt: CheckoutReceipt }
  | { kind: "error"; message: string };
