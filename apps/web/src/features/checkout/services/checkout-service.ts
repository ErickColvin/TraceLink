import type { CheckoutResponse } from "@tracelink/contracts";
import type { RequestOptions } from "@/lib/http/http-client";
import type { CheckoutInput, CheckoutReceipt } from "../domain";

export interface CheckoutService {
  submit(
    input: CheckoutInput,
    options?: RequestOptions,
  ): Promise<CheckoutReceipt | CheckoutResponse>;
}

export class EmptyCheckoutError extends Error {
  constructor() {
    super("El carrito no tiene productos para preparar el pedido.");
    this.name = "EmptyCheckoutError";
  }
}
