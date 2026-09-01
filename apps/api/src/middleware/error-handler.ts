import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";

import { AppError } from "../shared/errors/app-error.js";
import { getResponseRequestId } from "./request-id.js";

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function normalizeInfrastructureError(error: unknown): AppError | null {
  const record = asRecord(error);
  const status = record?.status ?? record?.statusCode;
  const type = record?.type;

  if (status === 413 || type === "entity.too.large") {
    return new AppError({
      statusCode: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "El cuerpo de la solicitud supera el límite permitido.",
    });
  }

  if (status === 400 && type === "entity.parse.failed") {
    return new AppError({
      statusCode: 400,
      code: "INVALID_JSON",
      message: "El cuerpo JSON de la solicitud no es válido.",
    });
  }

  return null;
}

export function notFoundHandler(): RequestHandler {
  return (request, _response, next) => {
    next(
      new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: `No existe una ruta para ${request.method} ${request.path}.`,
      }),
    );
  };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const requestId = getResponseRequestId(response);
    const normalized =
      error instanceof AppError
        ? error
        : normalizeInfrastructureError(error) ??
          new AppError({
            statusCode: 500,
            code: "INTERNAL_ERROR",
            message: "Ocurrió un error interno inesperado.",
            cause: error,
          });

    if (normalized.statusCode >= 500) {
      logger.error(
        { err: normalized.cause ?? error, requestId, errorCode: normalized.code },
        "Request failed",
      );
    } else {
      logger.warn(
        { requestId, errorCode: normalized.code, statusCode: normalized.statusCode },
        "Request rejected",
      );
    }

    response.status(normalized.statusCode).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details === undefined
          ? {}
          : { details: normalized.details }),
      },
      requestId,
    });
  };
}
