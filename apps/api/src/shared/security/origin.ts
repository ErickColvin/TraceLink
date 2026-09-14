import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isAllowedOrigin(
  receivedOrigin: string | undefined,
  allowedOrigin: string,
): boolean {
  return receivedOrigin === allowedOrigin;
}

export function enforceMutationOrigin(allowedOrigin: string): RequestHandler {
  return (request, _response, next) => {
    if (!MUTATING_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    if (!isAllowedOrigin(request.get("origin"), allowedOrigin)) {
      next(
        new AppError({
          statusCode: 403,
          code: "ORIGIN_NOT_ALLOWED",
          message: "El origen de la solicitud no está autorizado.",
        }),
      );
      return;
    }

    next();
  };
}
