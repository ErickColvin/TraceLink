import pino, { type Logger } from "pino";
import pinoHttp from "pino-http";

import type { AppConfig } from "../../config/env.js";
import { REQUEST_ID_HEADER } from "../../middleware/request-id.js";

const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)([^\s:/@]+):([^\s/@]+)@/gi;
const BEARER_TOKEN = /\bBearer\s+[^\s,;]+/gi;
const SENSITIVE_ASSIGNMENT =
  /\b(password|passwordHash|sessionToken|csrfToken|pickupCode|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi;

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function unwrapRaw(value: unknown): Readonly<Record<string, unknown>> | null {
  const record = asRecord(value);
  return asRecord(record?.raw) ?? record;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(URL_CREDENTIALS, "$1[REDACTED]@")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(SENSITIVE_ASSIGNMENT, "$1=[REDACTED]");
}

function serializeError(value: unknown): Readonly<Record<string, unknown>> {
  if (!(value instanceof Error)) {
    return { type: "UnknownError" };
  }

  return {
    type: value.name,
    message: redactSensitiveText(value.message),
    ...(value.stack === undefined
      ? {}
      : { stack: redactSensitiveText(value.stack) }),
  };
}

function serializeRequest(value: unknown): Readonly<Record<string, unknown>> {
  const request = unwrapRaw(value);
  return {
    id: request?.id,
    method: request?.method,
    url: request?.url,
    remoteAddress: request?.remoteAddress,
  };
}

function serializeResponse(value: unknown): Readonly<Record<string, unknown>> {
  const response = unwrapRaw(value);
  return { statusCode: response?.statusCode };
}

export function createLogger(
  config: Pick<AppConfig, "nodeEnv" | "logLevel">,
): Logger {
  return pino({
    level: config.logLevel,
    base: {
      service: "tracelink-api",
      environment: config.nodeEnv,
    },
    redact: {
      censor: "[REDACTED]",
      paths: [
        "password",
        "passwordHash",
        "sessionToken",
        "csrfToken",
        "pickupCode",
        "authorization",
        "cookie",
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-csrf-token",
        "res.headers.set-cookie",
      ],
    },
    serializers: { err: serializeError },
  });
}

export function createRequestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (_request, response) => {
      const requestId = response.getHeader(REQUEST_ID_HEADER);
      return typeof requestId === "string" ? requestId : "unavailable";
    },
    customProps: (_request, response) => ({
      requestId: response.getHeader(REQUEST_ID_HEADER),
    }),
    serializers: {
      err: serializeError,
      req: serializeRequest,
      res: serializeResponse,
    },
  });
}
