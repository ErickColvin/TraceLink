export const CUSTOMER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export interface CustomerAddress {
  line1: string;
  line2?: string;
  commune: string;
  city: string;
  region: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  taxId?: string;
  status: CustomerStatus;
  address?: CustomerAddress;
  createdAt: string;
}

export const CUSTOMER_SORT_OPTIONS = ["NEWEST", "NAME_ASC", "NAME_DESC"] as const;

export type CustomerSort = (typeof CUSTOMER_SORT_OPTIONS)[number];

export interface CustomerListParams {
  search?: string;
  status?: CustomerStatus;
  sort?: CustomerSort;
  page?: number;
  pageSize?: number;
}

export interface CustomerPage {
  items: Customer[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomerProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: CustomerAddress;
}

export interface StaffCustomerUpdateInput extends CustomerProfileInput {
  status: CustomerStatus;
}

export interface StaffCustomerSummary extends Customer {
  orderCount: number;
  activePackageCount: number;
  lastActivityAt: string;
}

export interface StaffCustomerPage {
  items: StaffCustomerSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status:
    | "PENDING_PAYMENT"
    | "PAID"
    | "PREPARING"
    | "READY"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED";
  total: number;
  updatedAt: string;
}

export interface CustomerPackageSummary {
  id: string;
  trackingCode: string;
  status:
    | "EXPECTED"
    | "RECEIVED"
    | "STORED"
    | "READY_FOR_PICKUP"
    | "PICKED_UP"
    | "RETURNED"
    | "LOST"
    | "INCIDENT";
  description: string;
  updatedAt: string;
}

export type CustomerActivityKind =
  | "CUSTOMER_CREATED"
  | "PROFILE_UPDATED"
  | "ORDER_UPDATED"
  | "PACKAGE_UPDATED";

export interface CustomerActivityEvent {
  id: string;
  kind: CustomerActivityKind;
  occurredAt: string;
  description: string;
  actor: "CUSTOMER" | "STAFF" | "SYSTEM";
}

export interface StaffCustomerDetail {
  customer: Customer;
  orderCount: number;
  activePackageCount: number;
  lastActivityAt: string;
  recentOrders: CustomerOrderSummary[];
  activePackages: CustomerPackageSummary[];
  activity: CustomerActivityEvent[];
}
