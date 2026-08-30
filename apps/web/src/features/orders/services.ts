import { MockOrderService } from "./services/mock-order-service";
import type { OrderService } from "./services/order-service";

export const orderService: OrderService = new MockOrderService();
