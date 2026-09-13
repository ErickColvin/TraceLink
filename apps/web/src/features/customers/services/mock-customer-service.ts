import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import {
  mockSessionContext,
  type CurrentCustomerResolver,
} from "../../mock-context";
import { mockCustomers } from "../data/mock-customers";
import { mockOrders } from "@/features/orders/data/mock-orders";
import type { Order } from "@/features/orders/domain";
import { mockPackages } from "@/features/packages/data/mock-packages";
import type { CustomerPackage } from "@/features/packages/domain";
import type {
  Customer,
  CustomerActivityEvent,
  CustomerListParams,
  CustomerOrderSummary,
  CustomerPackageSummary,
  CustomerProfileInput,
  CustomerSort,
  StaffCustomerDetail,
  StaffCustomerPage,
  StaffCustomerSummary,
  StaffCustomerUpdateInput,
} from "../domain";
import {
  CustomerConflictError,
  CustomerNotFoundError,
  type CustomerService,
} from "./customer-service";

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

function sortCustomers<T extends Customer>(customers: T[], sort: CustomerSort): T[] {
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

export type MockCustomerServiceOptions = Readonly<{
  customers?: readonly Customer[];
  orders?: readonly Order[];
  packages?: readonly CustomerPackage[];
  latencyMs?: number;
  now?: () => Date;
}>;

const TERMINAL_PACKAGE_STATUSES = new Set(["PICKED_UP", "RETURNED", "LOST"]);

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeProfile(input: CustomerProfileInput): CustomerProfileInput {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLocaleLowerCase(tenantBrand.locale),
    phone: normalizeOptional(input.phone),
    address: input.address
      ? {
          line1: input.address.line1.trim(),
          line2: normalizeOptional(input.address.line2),
          commune: input.address.commune.trim(),
          city: input.address.city.trim(),
          region: input.address.region.trim(),
        }
      : undefined,
  };
}

export class MockCustomerService implements CustomerService {
  private readonly customers: Customer[];
  private readonly orders: readonly Order[];
  private readonly packages: readonly CustomerPackage[];
  private readonly profileEvents: CustomerActivityEvent[] = [];
  private readonly latencyMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly customerResolver: CurrentCustomerResolver = mockSessionContext,
    options: MockCustomerServiceOptions = {},
  ) {
    this.customers = (options.customers ?? mockCustomers).map(cloneCustomer);
    this.orders = options.orders ?? mockOrders;
    this.packages = options.packages ?? mockPackages;
    this.latencyMs = options.latencyMs ?? 120;
    this.now = options.now ?? (() => new Date());
  }

  async getCurrent(): Promise<Customer> {
    const currentCustomerId = this.customerResolver.requireCurrentCustomerId();
    await delay(this.latencyMs);
    const customer = this.customers.find(
      (candidate) => candidate.id === currentCustomerId,
    );

    if (!customer) throw new CustomerNotFoundError(currentCustomerId);
    return cloneCustomer(customer);
  }

  async updateCurrent(input: CustomerProfileInput): Promise<Customer> {
    const currentCustomerId = this.customerResolver.requireCurrentCustomerId();
    await delay(this.latencyMs);
    const updated = this.updateCustomerRecord(currentCustomerId, input);
    this.addProfileEvent(currentCustomerId, "CUSTOMER");
    return cloneCustomer(updated);
  }

  async list(params: CustomerListParams = {}): Promise<StaffCustomerPage> {
    await delay(this.latencyMs);

    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const search = params.search ? normalizeText(params.search) : undefined;
    const filtered = this.customers
      .filter((customer) => !params.status || customer.status === params.status)
      .filter((customer) => {
        if (!search) return true;
        return normalizeText(
          `${customer.firstName} ${customer.lastName} ${customer.email} ${customer.phone ?? ""} ${customer.taxId ?? ""}`,
        ).includes(search);
      })
      .map((customer) => this.toStaffSummary(customer));
    const sorted = sortCustomers(filtered, params.sort ?? "NEWEST");
    const totalItems = sorted.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async getById(id: string): Promise<StaffCustomerDetail> {
    await delay(this.latencyMs);
    const customer = this.customers.find((candidate) => candidate.id === id);

    if (!customer) throw new CustomerNotFoundError(id);
    return this.toStaffDetail(customer);
  }

  async update(
    id: string,
    input: StaffCustomerUpdateInput,
  ): Promise<StaffCustomerDetail> {
    await delay(this.latencyMs);
    const updated = this.updateCustomerRecord(id, input, input.status);
    this.addProfileEvent(id, "STAFF");
    return this.toStaffDetail(updated);
  }

  private updateCustomerRecord(
    id: string,
    input: CustomerProfileInput,
    status?: Customer["status"],
  ): Customer {
    const index = this.customers.findIndex((customer) => customer.id === id);
    const current = this.customers[index];
    if (index < 0 || !current) throw new CustomerNotFoundError(id);

    const normalized = normalizeProfile(input);
    const duplicateEmail = this.customers.some(
      (customer) =>
        customer.id !== id &&
        normalizeText(customer.email) === normalizeText(normalized.email),
    );
    if (duplicateEmail) throw new CustomerConflictError("email");

    const updated: Customer = {
      ...current,
      ...normalized,
      status: status ?? current.status,
    };
    this.customers[index] = updated;
    return updated;
  }

  private addProfileEvent(
    customerId: string,
    actor: CustomerActivityEvent["actor"],
  ): void {
    const occurredAt = this.now().toISOString();
    this.profileEvents.unshift({
      id: `customer-activity-${customerId}-${occurredAt}`,
      kind: "PROFILE_UPDATED",
      occurredAt,
      description:
        actor === "CUSTOMER"
          ? "El cliente actualizó sus datos de perfil."
          : "El personal actualizó los datos del cliente.",
      actor,
    });
  }

  private getCustomerOrders(customerId: string): CustomerOrderSummary[] {
    return this.orders
      .filter((order) => order.customerId === customerId)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        updatedAt: order.updatedAt,
      }))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  private getCustomerPackages(customerId: string): CustomerPackageSummary[] {
    return this.packages
      .filter((item) => item.customerId === customerId)
      .map((item) => ({
        id: item.id,
        trackingCode: item.trackingCode,
        status: item.status,
        description: item.contents.description,
        updatedAt: item.updatedAt,
      }))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  private getActivity(customer: Customer): CustomerActivityEvent[] {
    const orderEvents: CustomerActivityEvent[] = this.getCustomerOrders(customer.id).map(
      (order) => ({
        id: `customer-order-${order.id}`,
        kind: "ORDER_UPDATED",
        occurredAt: order.updatedAt,
        description: `Pedido ${order.orderNumber} actualizado.`,
        actor: "SYSTEM",
      }),
    );
    const packageEvents: CustomerActivityEvent[] = this.getCustomerPackages(
      customer.id,
    ).map((item) => ({
      id: `customer-package-${item.id}`,
      kind: "PACKAGE_UPDATED",
      occurredAt: item.updatedAt,
      description: `Paquete ${item.trackingCode} actualizado.`,
      actor: "SYSTEM",
    }));
    const createdEvent: CustomerActivityEvent = {
      id: `customer-created-${customer.id}`,
      kind: "CUSTOMER_CREATED",
      occurredAt: customer.createdAt,
      description: "Cliente incorporado a la plataforma.",
      actor: "SYSTEM",
    };

    return [
      ...this.profileEvents.filter((event) => event.id.includes(customer.id)),
      ...orderEvents,
      ...packageEvents,
      createdEvent,
    ].sort(
      (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    );
  }

  private toStaffSummary(customer: Customer): StaffCustomerSummary {
    const orders = this.getCustomerOrders(customer.id);
    const activePackages = this.getCustomerPackages(customer.id).filter(
      (item) => !TERMINAL_PACKAGE_STATUSES.has(item.status),
    );
    const activity = this.getActivity(customer);

    return {
      ...cloneCustomer(customer),
      orderCount: orders.length,
      activePackageCount: activePackages.length,
      lastActivityAt: activity[0]?.occurredAt ?? customer.createdAt,
    };
  }

  private toStaffDetail(customer: Customer): StaffCustomerDetail {
    const orders = this.getCustomerOrders(customer.id);
    const activePackages = this.getCustomerPackages(customer.id).filter(
      (item) => !TERMINAL_PACKAGE_STATUSES.has(item.status),
    );
    const activity = this.getActivity(customer);

    return {
      customer: cloneCustomer(customer),
      orderCount: orders.length,
      activePackageCount: activePackages.length,
      lastActivityAt: activity[0]?.occurredAt ?? customer.createdAt,
      recentOrders: orders.slice(0, 5),
      activePackages: activePackages.slice(0, 5),
      activity: activity.slice(0, 12),
    };
  }
}
