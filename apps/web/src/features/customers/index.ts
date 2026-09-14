export * from "./domain";
export * from "./queries/customer-queries";
export {
  customerSelfService,
  customerService,
  staffCustomerService,
} from "./services";
export type {
  CustomerSelfService,
  CustomerService,
  StaffCustomerService,
} from "./services/customer-service";
export {
  CustomerConflictError,
  CustomerNotFoundError,
} from "./services/customer-service";
