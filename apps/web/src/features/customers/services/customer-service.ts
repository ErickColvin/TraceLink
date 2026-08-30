import type { Customer, CustomerListParams, CustomerPage } from "../domain";

export interface CustomerService {
  getCurrent(): Promise<Customer>;
  list(params?: CustomerListParams): Promise<CustomerPage>;
  getById(id: string): Promise<Customer>;
}

export class CustomerNotFoundError extends Error {
  constructor(id: string) {
    super(`No se encontró el cliente '${id}'.`);
    this.name = "CustomerNotFoundError";
  }
}
