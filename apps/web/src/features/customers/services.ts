import type {
  CustomerSelfService,
  CustomerService,
  StaffCustomerService,
} from "./services/customer-service";
import { applicationServices } from "../service-composition";

export const customerSelfService: CustomerSelfService =
  applicationServices.customerSelfService;
export const staffCustomerService: StaffCustomerService =
  applicationServices.staffCustomerService;

/** @deprecated Prefer customerSelfService or staffCustomerService. */
export const customerService: CustomerService = applicationServices.customerService;
