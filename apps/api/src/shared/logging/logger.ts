import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";
import { pinoHttp } from "pino-http";

import type { AppConfig } from "../../config/env.js";
import { REQUEST_ID_HEADER } from "../../middleware/request-id.js";

const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)([^\s:/@]+):([^\s/@]+)@/gi;
const BEARER_TOKEN = /\bBearer\s+[^\s,;]+/gi;
const URL_PARAMETER = /([?&#])([^=&#\s]+)(=)([^&#\s]*)/g;
const NON_WHITESPACE_TOKEN = /\S+/g;
const SENSITIVE_ASSIGNMENT =
  /(["']?[a-z0-9_-]*(?:password|secret|session|token|csrf|authorization|cookie|pickup[-_]?code|api[-_]?key)[a-z0-9_-]*["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;&}]+)/gi;

const SENSITIVE_KEYS = new Set([
  "apikey",
  "authorization",
  "cookie",
  "csrf",
  "csrftoken",
  "idempotencykey",
  "password",
  "passwordhash",
  "pickupcode",
  "refreshtoken",
  "session",
  "sessionid",
  "sessiontoken",
  "sessiontokenhash",
  "setcookie",
]);

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function unwrapRaw(value: unknown): Readonly<Record<string, unknown>> | null {
  const record = asRecord(value);
  return asRecord(record?.raw) ?? record;
}

function decodeKey(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function normalizedSensitiveKey(key: string): string {
  return decodeKey(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizedSensitiveKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    [
      "apikey",
      "authorization",
      "cookie",
      "csrf",
      "password",
      "pickupcode",
      "secret",
      "session",
      "token",
    ].some((marker) => normalized.includes(marker))
  );
}

function redactUrlParameter(
  match: string,
  prefix: string,
  key: string,
  separator: string,
): string {
  return isSensitiveKey(key)
    ? `${prefix}${key}${separator}[REDACTED]`
    : match;
}

function redactPathSegments(value: string): string {
  const suffixIndex = value.search(/[?#]/);
  const path = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : value.slice(suffixIndex);
  const segments = path.split("/");

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment !== undefined && isSensitiveKey(segment)) {
      segments[index + 1] = "[REDACTED]";
    }
  }

  return `${segments.join("/")}${suffix}`;
}

export function redactSensitiveText(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.stringify(redactSensitiveValue(JSON.parse(value)));
    } catch {
      // Continue with conservative text redaction for malformed/embedded JSON.
    }
  }

  return value
    .replace(URL_CREDENTIALS, "$1[REDACTED]@")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(NON_WHITESPACE_TOKEN, redactPathSegments)
    .replace(URL_PARAMETER, redactUrlParameter)
    .replace(SENSITIVE_ASSIGNMENT, "$1[REDACTED]");
}

export function redactRequestUrl(value: string): string {
  return redactSensitiveText(value);
}

function redactObject(
  value: object,
  seen: WeakMap<object, unknown>,
  depth: number,
): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = {};
  seen.set(value, output);
  for (const [key, nestedValue] of Object.entries(value)) {
    output[key] = isSensitiveKey(key)
      ? "[REDACTED]"
      : redactSensitiveValue(nestedValue, seen, depth + 1);
  }
  return output;
}

export function redactSensitiveValue(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
  depth = 0,
): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error || Buffer.isBuffer(value) || value instanceof Date) {
    return value;
  }
  if (value instanceof URL) return redactSensitiveText(value.toString());
  if (depth >= 12) return "[TRUNCATED]";

  const previous = seen.get(value);
  if (previous !== undefined) return "[CIRCULAR]";
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    seen.set(value, output);
    for (const nestedValue of value) {
      output.push(redactSensitiveValue(nestedValue, seen, depth + 1));
    }
    return output;
  }
  return redactObject(value, seen, depth);
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
  const url = request?.url;
  return {
    id: request?.id,
    method: request?.method,
    url: typeof url === "string" ? redactRequestUrl(url) : url,
    remoteAddress: request?.remoteAddress,
  };
}

function serializeResponse(value: unknown): Readonly<Record<string, unknown>> {
  const response = unwrapRaw(value);
  return { statusCode: response?.statusCode };
}

export function createLogger(
  config: Pick<AppConfig, "nodeEnv" | "logLevel"> &
    Partial<Pick<AppConfig, "appEnv">>,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    level: config.logLevel,
    base: {
      service: "tracelink-api",
      environment: config.appEnv ?? config.nodeEnv,
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
    formatters: {
      bindings: (bindings) => redactObject(bindings, new WeakMap(), 0),
      log: (object) => redactObject(object, new WeakMap(), 0),
    },
    hooks: {
      logMethod(args, method) {
        for (let index = 0; index < args.length; index += 1) {
          Reflect.set(args, index, redactSensitiveValue(args[index]));
        }
        method.apply(this, args);
      },
    },
    serializers: { err: serializeError },
  };
  return destination === undefined
    ? pino(options)
    : pino(options, destination);
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
