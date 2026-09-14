import { Router, type RequestHandler } from "express";
import type { Logger } from "pino";
import { z } from "zod";

import type { PostgresDatabase } from "../../database/index.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { AppError } from "../../shared/errors/app-error.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { PaymentProvider } from "./payment-provider.js";
import { PaymentWebhookService } from "./payment-webhook-service.js";

const webhookSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  type: z.string().trim().min(1).max(80),
  action: z.string().trim().min(1).max(160),
  data: z.object({ id: z.union([z.string(), z.number()]).transform(String) }).passthrough(),
  live_mode: z.boolean().optional(),
  date_created: z.string().trim().max(100).optional(),
}).passthrough();

function requiredHeader(request: Parameters<RequestHandler>[0], name: string): string {
  const value = request.get(name);
  if (value === undefined || value.trim() === "") {
    throw new AppError({
      statusCode: 400,
      code: "WEBHOOK_HEADER_REQUIRED",
      message: `Falta el header ${name}.`,
    });
  }
  return value;
}

export function createPaymentWebhookRouter(options: Readonly<{
  database: PostgresDatabase;
  provider: PaymentProvider;
  logger: Logger;
}>): Router {
  const router = Router();
  const service = new PaymentWebhookService(options.database, options.provider);
  router.post("/mercadopago", async (request, response) => {
    const body = parseWithSchema(webhookSchema, request.body, "body");
    const queryDataId = typeof request.query["data.id"] === "string"
      ? request.query["data.id"]
      : undefined;
    const dataId = queryDataId ?? body.data.id;
    if (dataId !== body.data.id) {
      throw new AppError({
        statusCode: 400,
        code: "WEBHOOK_RESOURCE_MISMATCH",
        message: "El recurso del webhook no coincide con el query param.",
      });
    }
    const requestId = getResponseRequestId(response);
    options.logger.info({
      event: "payment.webhook.received",
      requestId,
      provider: options.provider.code,
      providerEventId: body.id,
      providerOrderId: dataId,
    });
    const result = await service.process({
      eventId: body.id,
      eventType: body.type,
      action: body.action,
      dataId,
      signature: requiredHeader(request, "x-signature"),
      providerRequestId: requiredHeader(request, "x-request-id"),
      requestId,
      ...(body.live_mode === undefined ? {} : { liveMode: body.live_mode }),
      ...(body.date_created === undefined ? {} : { dateCreated: body.date_created }),
    });
    options.logger.info({
      event: result.duplicate
        ? "payment.webhook.duplicate"
        : "payment.webhook.validated",
      requestId,
      provider: options.provider.code,
      providerEventId: body.id,
      providerOrderId: dataId,
      outcome: result.outcome,
    });
    response.status(200).json({ received: true, ...result });
  });
  return router;
}
