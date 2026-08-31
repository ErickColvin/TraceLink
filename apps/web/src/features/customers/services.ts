import { MockCustomerService } from "./services/mock-customer-service";
import type {
  CustomerSelfService,
  CustomerService,
  StaffCustomerService,
} from "./services/customer-service";

const mockCustomerService = new MockCustomerService();

export const customerSelfService: CustomerSelfService = mockCustomerService;
export const staffCustomerService: StaffCustomerService = mockCustomerService;

/** @deprecated Prefer customerSelfService or staffCustomerService. */
export const customerService: CustomerService = mockCustomerService;
