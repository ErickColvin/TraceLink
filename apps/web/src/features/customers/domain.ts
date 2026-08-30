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
