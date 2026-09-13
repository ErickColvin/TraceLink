import { applicationServices } from "../service-composition";
import type { CheckoutService } from "./services/checkout-service";

export const checkoutService: CheckoutService = applicationServices.checkoutService;
