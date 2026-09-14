import type { Request, RequestHandler, Response } from "express";

import type { Permission } from "@tracelink/contracts";

import type { AuthContext, AuthRepositoryPort } from "../modules/auth/auth-types.js";
import { AppError } from "../shared/errors/app-error.js";
import {
  getSessionCookieName,
  readSessionCookie,
  serializeExpiredSessionCookie,
} from "../shared/security/session-cookie.js";
import {
  hashSessionToken,
  isSessionToken,
} from "../shared/security/session-token.js";

function unauthenticated(code = "UNAUTHENTICATED"): AppError {
  return new AppError({
    statusCode: 401,
    code,
    message: "Debes iniciar sesión para continuar.",
  });
}

function clearSessionCookie(response: Response, nodeEnv: string): void {
  response.setHeader(
    "Set-Cookie",
    serializeExpiredSessionCookie({
      name: getSessionCookieName(nodeEnv),
      secure: nodeEnv === "production",
    }),
  );
}

export function createAuthenticate(options: Readonly<{
  repository: AuthRepositoryPort;
  sessionSecret: string;
  sessionIdleTtlSeconds: number;
  nodeEnv: string;
}>): RequestHandler {
  const cookieName = getSessionCookieName(options.nodeEnv);
  return async (request, response, next) => {
    try {
      const token = readSessionCookie(request.get("cookie"), cookieName);
      if (token === undefined || !isSessionToken(token)) {
        clearSessionCookie(response, options.nodeEnv);
        throw unauthenticated();
      }

      const tokenHash = hashSessionToken(options.sessionSecret, token);
      const context = await options.repository.resolveSession(tokenHash);
      if (context === null) {
        clearSessionCookie(response, options.nodeEnv);
        throw unauthenticated();
      }

      const idleMilliseconds = Date.now() - context.lastSeenAt.getTime();
      if (idleMilliseconds > options.sessionIdleTtlSeconds * 1_000) {
        await options.repository.revokeSession(context.sessionId, "idle_timeout");
        clearSessionCookie(response, options.nodeEnv);
        throw unauthenticated("SESSION_EXPIRED");
      }

      request.auth = context;
      if (idleMilliseconds > 60_000) {
        await options.repository.touchSession(context.sessionId);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getAuthContext(request: Request): AuthContext {
  if (request.auth === undefined) throw unauthenticated();
  return request.auth;
}

export function requireCustomer(): RequestHandler {
  return (request, _response, next) => {
    const context = getAuthContext(request);
    if (context.audience !== "customer") {
      next(
        new AppError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Esta operación requiere una sesión de cliente.",
        }),
      );
      return;
    }
    next();
  };
}

export function requireStaff(): RequestHandler {
  return (request, _response, next) => {
    const context = getAuthContext(request);
    if (context.audience !== "staff") {
      next(
        new AppError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "Esta operación requiere una sesión de personal.",
        }),
      );
      return;
    }
    next();
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return (request, _response, next) => {
    const context = getAuthContext(request);
    if (
      context.audience !== "staff" ||
      !context.permissions.includes(permission)
    ) {
      next(
        new AppError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: "No tienes permisos para realizar esta operación.",
        }),
      );
      return;
    }
    next();
  };
}

