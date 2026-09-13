import type {
  Customer,
  CustomerProfileInput,
  StaffCustomerDetail,
  StaffCustomerListParams,
  StaffCustomerPage,
  StaffCustomerUpdateInput,
} from "@tracelink/contracts";

import { PostgresCustomerRepository } from "./customer-repository.js";

export class CustomerService {
  readonly #repository: PostgresCustomerRepository;

  constructor(repository: PostgresCustomerRepository) {
    this.#repository = repository;
  }

  getCurrent(organizationId: string, customerId: string): Promise<Customer> {
    return this.#repository.getCurrent(organizationId, customerId);
  }

  updateCurrent(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    input: CustomerProfileInput;
    requestId: string;
  }>): Promise<Customer> {
    return this.#repository.updateCurrent(options);
  }

  listStaff(
    organizationId: string,
    params: StaffCustomerListParams,
  ): Promise<StaffCustomerPage> {
    return this.#repository.listStaff(organizationId, params);
  }

  getStaffDetail(
    organizationId: string,
    customerId: string,
  ): Promise<StaffCustomerDetail> {
    return this.#repository.getStaffDetail(organizationId, customerId);
  }

  updateStaff(options: Readonly<{
    organizationId: string;
    customerId: string;
    actorUserId: string;
    input: StaffCustomerUpdateInput;
    requestId: string;
  }>): Promise<StaffCustomerDetail> {
    return this.#repository.updateStaff(options);
  }
}
