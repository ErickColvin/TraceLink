import { delay } from "@/lib/delay";

import type { CheckoutInput, CheckoutReceipt } from "../domain";
import { EmptyCheckoutError, type CheckoutService } from "./checkout-service";

let nextDemoOrderNumber = 2108;

export class MockCheckoutService implements CheckoutService {
  async submit(input: CheckoutInput): Promise<CheckoutReceipt> {
    await delay(500);

    if (input.items.length === 0) throw new EmptyCheckoutError();

    const orderCode = `CH-${nextDemoOrderNumber}`;
    nextDemoOrderNumber += 1;

    return {
      orderCode,
      receivedAt: new Date().toISOString(),
      itemCount: input.items.reduce((total, item) => total + item.quantity, 0),
      total: input.total,
      deliveryMethod: input.deliveryMethod,
    };
  }
}
