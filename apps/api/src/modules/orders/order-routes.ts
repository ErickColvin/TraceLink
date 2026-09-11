import { Router, type RequestHandler } from "express";

import type { AppConfig } from "../../config/env.js";
import type { PostgresDatabase } from "../../database/index.js";
import {
  requireCustomer,
  requirePermission,
  requireStaff,
} from "../../middleware/authenticate.js";
import { createOrderController } from "./order-controller.js";
import { OrderService } from "./order-service.js";
import type { PaymentProvider } from "../payments/payment-provider.js";
import { PaymentRetryService } from "../payments/payment-retry-service.js";
import { CustomerOrderActionsService } from "./customer-order-actions-service.js";
import { cancelPaymentRequestSchema, orderIdParamsSchema } from "@tracelink/contracts";
import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { readIdempotencyKey } from "../../shared/idempotency/idempotency.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import { createFullRefundRequestSchema } from "@tracelink/contracts";
import { RefundService } from "../payments/refund-service.js";

export function createOrderRouter(options: Readonly<{
  database: PostgresDatabase;
  config: AppConfig;
  paymentProvider: PaymentProvider;
  authenticate: RequestHandler;
  csrf: RequestHandler;
}>): Router {
  const controller = createOrderController(
    new OrderService(options.database, options.config.idempotencySecret),
  );
  const router = Router();
  const paymentRetry = new PaymentRetryService({
    database: options.database,
    idempotencySecret: options.config.idempotencySecret,
    provider: options.paymentProvider,
    reservationMinutes: options.config.checkoutReservationMinutes,
  });
  const customerActions = new CustomerOrderActionsService(
    options.database,
    options.config.idempotencySecret,
  );
  const refunds = new RefundService({
    database: options.database,
    provider: options.paymentProvider,
    idempotencySecret: options.config.idempotencySecret,
  });
  const customerRead = [options.authenticate, requireCustomer()] as const;
  const staffRead = [
    options.authenticate,
    requireStaff(),
    requirePermission("orders.view"),
  ] as const;

  router.get("/me/orders", ...customerRead, controller.listCurrentCustomer);
  router.get(
    "/me/orders/:id",
    ...customerRead,
    controller.getCurrentCustomerById,
  );
  router.post(
    "/me/orders/:id/payment-attempts",
    ...customerRead,
    options.csrf,
    async (request, response) => {
      const auth = getAuthContext(request);
      if (auth.audience !== "customer") throw new Error("Customer middleware invariant failed.");
      const { id } = parseWithSchema(orderIdParamsSchema, request.params, "params");
      const result = await paymentRetry.retry({
        organizationId: auth.organization.id,
        customerId: auth.customerId,
        actorUserId: auth.user.id,
        orderId: id,
        idempotencyKey: readIdempotencyKey(request),
        requestId: getResponseRequestId(response),
      });
      if (result.replayed) response.setHeader("Idempotency-Replayed", "true");
      response.status(201).json(result.body);
    },
  );
  router.post(
    "/me/orders/:id/cancellation",
    ...customerRead,
    options.csrf,
    async (request, response) => {
      const auth = getAuthContext(request);
      if (auth.audience !== "customer") throw new Error("Customer middleware invariant failed.");
      const { id } = parseWithSchema(orderIdParamsSchema, request.params, "params");
      const input = parseWithSchema(cancelPaymentRequestSchema, request.body, "body");
      const result = await customerActions.cancel({
        organizationId: auth.organization.id,
        customerId: auth.customerId,
        actorUserId: auth.user.id,
        orderId: id,
        reason: input.reason,
        idempotencyKey: readIdempotencyKey(request),
        requestId: getResponseRequestId(response),
      });
      if (result.replayed) response.setHeader("Idempotency-Replayed", "true");
      response.status(result.statusCode).json(result.body);
    },
  );
  router.post(
    "/staff/orders/:id/transitions",
    options.authenticate,
    requireStaff(),
    requirePermission("orders.update"),
    options.csrf,
    controller.transitionStatus,
  );
  router.post(
    "/staff/orders/:id/cancellation",
    options.authenticate,
    requireStaff(),
    requirePermission("orders.cancel"),
    options.csrf,
    controller.cancel,
  );
  router.post(
    "/staff/orders/:id/refunds",
    options.authenticate,
    requireStaff(),
    requirePermission("orders.refund"),
    options.csrf,
    async (request, response) => {
      const auth = getAuthContext(request);
      const { id } = parseWithSchema(orderIdParamsSchema, request.params, "params");
      const input = parseWithSchema(createFullRefundRequestSchema, request.body, "body");
      const result = await refunds.refund({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        orderId: id,
        input,
        idempotencyKey: readIdempotencyKey(request),
        requestId: getResponseRequestId(response),
      });
      if (result.replayed) response.setHeader("Idempotency-Replayed", "true");
      response.status(200).json(result.body);
    },
  );
  router.get("/staff/orders/:id", ...staffRead, controller.getStaffById);
  router.get("/staff/orders", ...staffRead, controller.listStaff);
  return router;
}
