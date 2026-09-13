import { applicationServices } from "../service-composition";
import type { OrderService } from "./services/order-service";
import type { StaffOrderService } from "./services/staff-order-service";

export const orderService: OrderService = applicationServices.orderService;
export const staffOrderService: StaffOrderService =
  applicationServices.staffOrderService;
