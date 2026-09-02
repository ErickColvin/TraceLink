import type { RequestHandler } from "express";

import { getAuthContext } from "./authenticate.js";
import { AppError } from "../shared/errors/app-error.js";
import { verifyCsrfToken } from "../shared/security/csrf-token.js";

export function requireCsrf(csrfSecret: string): RequestHandler {
  return (request, _response, next) => {
    const context = getAuthContext(request);
    const token = request.get("x-csrf-token");
    if (
      token === undefined ||
      !verifyCsrfToken(
        csrfSecret,
        context.sessionId,
        context.sessionTokenHash,
        token,
      )
    ) {
      next(
        new AppError({
          statusCode: 403,
          code: "CSRF_INVALID",
          message: "El token CSRF no es válido o está ausente.",
        }),
      );
      return;
    }
    next();
  };
}

