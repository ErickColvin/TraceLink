import type { RequestHandler } from "express";
import {
  registerRequestSchema,
  signInRequestSchema,
} from "@tracelink/contracts";

import type { AppConfig } from "../../config/env.js";
import { getAuthContext } from "../../middleware/authenticate.js";
import {
  getSessionCookieName,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
} from "../../shared/security/session-cookie.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { AuthServicePort } from "./auth-types.js";

function setPrivateResponseHeaders(response: Parameters<RequestHandler>[1]): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
}

export function createAuthController(
  service: AuthServicePort,
  config: AppConfig,
): Readonly<{
  login: RequestHandler;
  register: RequestHandler;
  me: RequestHandler;
  logout: RequestHandler;
}> {
  const cookieName = getSessionCookieName(config.nodeEnv);
  const secure = config.nodeEnv === "production";

  return {
    login: async (request, response) => {
      const input = parseWithSchema(signInRequestSchema, request.body, "body");
      const result = await service.signIn(input);
      setPrivateResponseHeaders(response);
      response.setHeader(
        "Set-Cookie",
        serializeSessionCookie({
          name: cookieName,
          token: result.sessionToken,
          maxAgeSeconds: config.sessionTtlSeconds,
          secure,
        }),
      );
      response.status(200).json(result.envelope);
    },
    register: async (request, response) => {
      const input = parseWithSchema(registerRequestSchema, request.body, "body");
      const result = await service.register(input);
      setPrivateResponseHeaders(response);
      response.setHeader(
        "Set-Cookie",
        serializeSessionCookie({
          name: cookieName,
          token: result.sessionToken,
          maxAgeSeconds: config.sessionTtlSeconds,
          secure,
        }),
      );
      response.status(201).json(result.envelope);
    },
    me: (request, response) => {
      setPrivateResponseHeaders(response);
      response.status(200).json(service.getSession(getAuthContext(request)));
    },
    logout: async (request, response) => {
      await service.signOut(getAuthContext(request));
      setPrivateResponseHeaders(response);
      response.setHeader(
        "Set-Cookie",
        serializeExpiredSessionCookie({ name: cookieName, secure }),
      );
      response.status(204).end();
    },
  };
}

