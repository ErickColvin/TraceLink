import {
  apiErrorResponseSchema,
  type ApiErrorCode,
} from "@tracelink/contracts";
import type { z } from "zod";

type QueryScalar = string | number | boolean;

export type HttpRequestOptions<T> = Readonly<{
  body?: unknown;
  csrf?: boolean;
  idempotencyKey?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: object;
  responseSchema: z.ZodType<T>;
}>;

export type HttpVoidRequestOptions = Omit<
  HttpRequestOptions<never>,
  "responseSchema"
>;

export type HttpClientErrorCode =
  | ApiErrorCode
  | "CSRF_TOKEN_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR";

export class HttpClientError extends Error {
  readonly code: HttpClientErrorCode;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>> | undefined;
  readonly requestId: string | undefined;
  readonly status: number | undefined;

  constructor(options: Readonly<{
    code: HttpClientErrorCode;
    message: string;
    status?: number;
    requestId?: string;
    fieldErrors?: Readonly<Record<string, readonly string[]>>;
    cause?: unknown;
  }>) {
    super(options.message, { cause: options.cause });
    this.name = "HttpClientError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.fieldErrors = options.fieldErrors;
  }
}

function appendQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: unknown,
): void {
  if (value === undefined || value === null || value === "") return;

  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(searchParams, key, item));
    return;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    searchParams.append(key, String(value satisfies QueryScalar));
  }
}

export function buildRequestUrl(
  baseUrl: string,
  path: string,
  query?: object,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const requestTarget = `${baseUrl.replace(/\/+$/, "")}${normalizedPath}`;
  const absolute = /^https?:\/\//iu.test(requestTarget);
  const url = new URL(requestTarget, absolute ? undefined : "http://tracelink.local");

  if (query !== undefined) {
    Object.entries(query).forEach(([key, value]) => {
      appendQueryValue(url.searchParams, key, value);
    });
  }

  return absolute ? url.toString() : `${url.pathname}${url.search}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    throw new HttpClientError({
      code: "INVALID_RESPONSE",
      message: "La API devolvió una respuesta que no es JSON válido.",
      requestId: response.headers.get("x-request-id") ?? undefined,
      status: response.status,
      cause: error,
    });
  }
}

function normalizeApiError(
  response: Response,
  payload: unknown,
): HttpClientError {
  const parsed = apiErrorResponseSchema.safeParse(payload);
  const headerRequestId = response.headers.get("x-request-id") ?? undefined;

  if (parsed.success) {
    return new HttpClientError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      status: response.status,
      requestId: parsed.data.requestId || headerRequestId,
      fieldErrors: parsed.data.error.fieldErrors,
    });
  }

  return new HttpClientError({
    code: "INVALID_RESPONSE",
    message: `La API rechazó la solicitud con estado ${response.status}.`,
    status: response.status,
    requestId: headerRequestId,
  });
}

export class HttpClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  #csrfToken: string | null = null;
  #lastRequestId: string | null = null;

  constructor(
    baseUrl: string,
    fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#fetch = fetchImplementation;
  }

  get lastRequestId(): string | null {
    return this.#lastRequestId;
  }

  setCsrfToken(token: string): void {
    this.#csrfToken = token;
  }

  clearCsrfToken(): void {
    this.#csrfToken = null;
  }

  async request<T>(path: string, options: HttpRequestOptions<T>): Promise<T> {
    const response = await this.#send(path, options);
    const payload = await readJson(response);
    const parsed = options.responseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new HttpClientError({
        code: "INVALID_RESPONSE",
        message: "La respuesta de la API no cumple el contrato esperado.",
        status: response.status,
        requestId: this.#lastRequestId ?? undefined,
        cause: parsed.error,
      });
    }

    return parsed.data;
  }

  async requestVoid(
    path: string,
    options: HttpVoidRequestOptions = {},
  ): Promise<void> {
    const response = await this.#send(path, options);
    if (response.status !== 204) await readJson(response);
  }

  async #send(
    path: string,
    options: HttpVoidRequestOptions | HttpRequestOptions<unknown>,
  ): Promise<Response> {
    const method = options.method ?? "GET";
    const headers = new Headers({ Accept: "application/json" });

    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (options.idempotencyKey !== undefined) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }
    if (options.csrf) {
      if (this.#csrfToken === null) {
        throw new HttpClientError({
          code: "CSRF_TOKEN_UNAVAILABLE",
          message: "La sesión no dispone de un token CSRF vigente.",
        });
      }
      headers.set("X-CSRF-Token", this.#csrfToken);
    }

    let response: Response;
    try {
      response = await this.#fetch(
        buildRequestUrl(this.#baseUrl, path, options.query),
        {
          method,
          headers,
          credentials: "include",
          ...(options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
        },
      );
    } catch (error: unknown) {
      if (error instanceof HttpClientError) throw error;
      throw new HttpClientError({
        code: "NETWORK_ERROR",
        message: "No fue posible comunicarse con la API.",
        cause: error,
      });
    }

    this.#lastRequestId = response.headers.get("x-request-id");
    if (!response.ok) throw normalizeApiError(response, await readJson(response));

    return response;
  }
}

export type RequestOptions = Readonly<{
  idempotencyKey?: string;
}>;

export function resolveIdempotencyKey(options?: RequestOptions): string {
  return options?.idempotencyKey ?? globalThis.crypto.randomUUID();
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
