import { MockCustomerService } from "./services/mock-customer-service";
import type { CustomerService } from "./services/customer-service";

export const customerService: CustomerService = new MockCustomerService();
