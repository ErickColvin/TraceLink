import type {
  DeliverStaffPackageInput,
  PackageCustomerOptionListParams,
  PackageCustomerOptionPage,
  ReceiveStaffPackageInput,
  StaffPackage,
  StaffPackageListParams,
  StaffPackagePage,
  TransitionStaffPackageInput,
} from "../domain";
import type { RequestOptions } from "../../../lib/http/http-client";

export interface StaffPackageService {
  /** Operational access; never used to resolve the current customer's scope. */
  list(params?: StaffPackageListParams): Promise<StaffPackagePage>;
  getById(id: string): Promise<StaffPackage>;
  listCustomerOptions(
    params?: PackageCustomerOptionListParams,
  ): Promise<PackageCustomerOptionPage>;
  receive(
    input: ReceiveStaffPackageInput,
    options?: RequestOptions,
  ): Promise<StaffPackage>;
  transitionStatus(
    input: TransitionStaffPackageInput,
    options?: RequestOptions,
  ): Promise<StaffPackage>;
  deliver(
    input: DeliverStaffPackageInput,
    options?: RequestOptions,
  ): Promise<StaffPackage>;
}

export class StaffPackageNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el paquete operativo '${id}'.`);
    this.name = "StaffPackageNotFoundError";
  }
}

export class StaffPackageCustomerNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el cliente seleccionado '${id}'.`);
    this.name = "StaffPackageCustomerNotFoundError";
  }
}

export class DuplicateTrackingCodeError extends Error {
  constructor(code: string) {
    super(`Ya existe un paquete con el código '${code}'.`);
    this.name = "DuplicateTrackingCodeError";
  }
}

export class InvalidPackageTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPackageTransitionError";
  }
}

export class InvalidPackageDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPackageDeliveryError";
  }
}
