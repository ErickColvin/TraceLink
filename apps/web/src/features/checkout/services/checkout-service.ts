import type { CheckoutInput, CheckoutReceipt } from "../domain";

export interface CheckoutService {
  submit(input: CheckoutInput): Promise<CheckoutReceipt>;
}

export class EmptyCheckoutError extends Error {
  constructor() {
    super("El carrito no tiene productos para preparar el pedido.");
    this.name = "EmptyCheckoutError";
  }
}
