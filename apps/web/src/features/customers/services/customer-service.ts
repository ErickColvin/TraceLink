import type {
  Customer,
  CustomerListParams,
  CustomerProfileInput,
  StaffCustomerDetail,
  StaffCustomerPage,
  StaffCustomerUpdateInput,
} from "../domain";

/** Identity is implicit. These operations never accept a customer id. */
export interface CustomerSelfService {
  getCurrent(): Promise<Customer>;
  updateCurrent(input: CustomerProfileInput): Promise<Customer>;
}

/** Staff-only customer directory. Authorization remains authoritative server-side. */
export interface StaffCustomerService {
  list(params?: CustomerListParams): Promise<StaffCustomerPage>;
  getById(id: string): Promise<StaffCustomerDetail>;
  update(id: string, input: StaffCustomerUpdateInput): Promise<StaffCustomerDetail>;
}

/** @deprecated Compatibility facade. Prefer the audience-specific contracts. */
export interface CustomerService extends CustomerSelfService, StaffCustomerService {}

export class CustomerNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el cliente '${id}'.`);
    this.name = "CustomerNotFoundError";
  }
}

export class CustomerConflictError extends Error {
  constructor(field: "email") {
    super(
      field === "email"
        ? "Ya existe un cliente con ese correo electrónico."
        : "Los datos del cliente están duplicados.",
    );
    this.name = "CustomerConflictError";
  }
}
