import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import {
  mockSessionContext,
  type CurrentCustomerResolver,
} from "../../mock-context";
import { mockCustomers } from "../data/mock-customers";
import type { Customer, CustomerListParams, CustomerPage, CustomerSort } from "../domain";
import { CustomerNotFoundError, type CustomerService } from "./customer-service";

const DEFAULT_PAGE_SIZE = 20;

function cloneCustomer(customer: Customer): Customer {
  return {
    ...customer,
    address: customer.address ? { ...customer.address } : undefined,
  };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase(tenantBrand.locale);
}

function sortCustomers(customers: Customer[], sort: CustomerSort): Customer[] {
  return customers.sort((left, right) => {
    switch (sort) {
      case "NEWEST":
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      case "NAME_ASC":
        return `${left.firstName} ${left.lastName}`.localeCompare(
          `${right.firstName} ${right.lastName}`,
          tenantBrand.locale,
        );
      case "NAME_DESC":
        return `${right.firstName} ${right.lastName}`.localeCompare(
          `${left.firstName} ${left.lastName}`,
          tenantBrand.locale,
        );
    }
  });
}

export class MockCustomerService implements CustomerService {
  constructor(
    private readonly customerResolver: CurrentCustomerResolver = mockSessionContext,
  ) {}

  async getCurrent(): Promise<Customer> {
    const currentCustomerId = this.customerResolver.requireCurrentCustomerId();
    await delay(100);
    const customer = mockCustomers.find(
      (candidate) => candidate.id === currentCustomerId,
    );

    if (!customer) throw new CustomerNotFoundError(currentCustomerId);
    return cloneCustomer(customer);
  }

  async list(params: CustomerListParams = {}): Promise<CustomerPage> {
    await delay(160);

    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const search = params.search ? normalizeText(params.search) : undefined;
    const filtered = mockCustomers
      .filter((customer) => !params.status || customer.status === params.status)
      .filter((customer) => {
        if (!search) return true;
        return normalizeText(
          `${customer.firstName} ${customer.lastName} ${customer.email} ${customer.taxId ?? ""}`,
        ).includes(search);
      })
      .map(cloneCustomer);
    const sorted = sortCustomers(filtered, params.sort ?? "NEWEST");
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

  async getById(id: string): Promise<Customer> {
    await delay(120);
    const customer = mockCustomers.find((candidate) => candidate.id === id);

    if (!customer) throw new CustomerNotFoundError(id);
    return cloneCustomer(customer);
  }
}
