import { MockOrderService } from "./services/mock-order-service";
import { MockStaffOrderService } from "./services/mock-staff-order-service";
import type { OrderService } from "./services/order-service";
import type { StaffOrderService } from "./services/staff-order-service";

export const orderService: OrderService = new MockOrderService();
export const staffOrderService: StaffOrderService = new MockStaffOrderService();
