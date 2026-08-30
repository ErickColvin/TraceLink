import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import {
  mockSessionContext,
  type CurrentCustomerResolver,
} from "../../mock-context";
import { mockPackages } from "../data/mock-packages";
import type {
  CurrentCustomerPackageListParams,
  CustomerPackage,
  PackagePage,
  PackageSort,
} from "../domain";
import { PackageNotFoundError, type PackageService } from "./package-service";

const DEFAULT_PAGE_SIZE = 10;

function clonePackage(customerPackage: CustomerPackage): CustomerPackage {
  return {
    ...customerPackage,
    contents: { ...customerPackage.contents },
    events: customerPackage.events.map((event) => ({ ...event })),
  };
}

function sortPackages(packages: CustomerPackage[], sort: PackageSort): CustomerPackage[] {
  return packages.sort((left, right) => {
    switch (sort) {
      case "NEWEST":
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      case "OLDEST":
        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      case "STATUS":
        return left.status.localeCompare(right.status);
    }
  });
}

export class MockPackageService implements PackageService {
  constructor(
    private readonly customerResolver: CurrentCustomerResolver = mockSessionContext,
  ) {}

  async listCurrentCustomer(
    params: CurrentCustomerPackageListParams = {},
  ): Promise<PackagePage> {
    const currentCustomerId = this.customerResolver.requireCurrentCustomerId();
    await delay(160);

    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const statuses = params.statuses ? new Set(params.statuses) : undefined;
    const search = params.search?.trim().toLocaleLowerCase(tenantBrand.locale);
    const filtered = mockPackages
      .filter((customerPackage) => customerPackage.customerId === currentCustomerId)
      .filter((customerPackage) => !statuses || statuses.has(customerPackage.status))
      .filter(
        (customerPackage) =>
          !search ||
          `${customerPackage.trackingCode} ${customerPackage.contents.description}`
            .toLocaleLowerCase(tenantBrand.locale)
            .includes(search),
      )
      .map(clonePackage);
    const sorted = sortPackages(filtered, params.sort ?? "NEWEST");
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

  async getCurrentCustomerById(id: string): Promise<CustomerPackage> {
    const currentCustomerId = this.customerResolver.requireCurrentCustomerId();
    await delay(130);
    const customerPackage = mockPackages.find(
      (candidate) =>
        candidate.id === id && candidate.customerId === currentCustomerId,
    );

    if (!customerPackage) throw new PackageNotFoundError(id);

    const result = clonePackage(customerPackage);
    result.events.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
    return result;
  }
}
