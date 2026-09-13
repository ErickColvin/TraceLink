import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { createCheckoutRequestSchema } from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { readIdempotencyKey } from "../../shared/idempotency/idempotency.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { CheckoutService } from "./checkout-service.js";

export function createCheckoutController(
  service: CheckoutService,
  logger: Logger,
): RequestHandler {
  return async (request, response) => {
    const auth = getAuthContext(request);
    if (auth.audience !== "customer") throw new Error("Customer middleware invariant failed.");
    const result = await service.checkout({
      organizationId: auth.organization.id,
      customerId: auth.customerId,
      actorUserId: auth.user.id,
      input: parseWithSchema(createCheckoutRequestSchema, request.body, "body"),
      requestId: getResponseRequestId(response),
      idempotencyKey: readIdempotencyKey(request),
    });
    if (result.replayed) response.setHeader("Idempotency-Replayed", "true");
    logger.info({
      event: "checkout.created",
      requestId: getResponseRequestId(response),
      organizationId: auth.organization.id,
      userId: auth.user.id,
      orderId: result.body.order.id,
      paymentId: result.body.payment.id,
      provider: result.body.payment.provider,
      replayed: result.replayed,
    });
    response.status(201).json(result.body);
  };
}
