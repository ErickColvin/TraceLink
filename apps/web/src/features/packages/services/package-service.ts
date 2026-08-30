import type {
  CurrentCustomerPackageListParams,
  CustomerPackage,
  PackagePage,
} from "../domain";

export interface PackageService {
  /** The adapter resolves the authenticated customer; callers cannot choose an owner. */
  listCurrentCustomer(params?: CurrentCustomerPackageListParams): Promise<PackagePage>;
  /** Returns not-found for records outside the authenticated customer's scope. */
  getCurrentCustomerById(id: string): Promise<CustomerPackage>;
}

export class PackageNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el paquete '${id}'.`);
    this.name = "PackageNotFoundError";
  }
}
