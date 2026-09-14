import { PaymentProviderError } from "./payment-provider-error.js";

const DEFAULT_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 10_000;

function retryAfterMilliseconds(value: string | null, now: number): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function retryDelay(attempt: number, response: Response | undefined): number {
  const fromHeader = response === undefined
    ? null
    : retryAfterMilliseconds(response.headers.get("retry-after"), Date.now());
  if (fromHeader !== null) return Math.min(fromHeader, MAX_RETRY_DELAY_MS);
  const exponential = 200 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function canRetry(response: Response): boolean {
  return response.status === 429 || response.status >= 500;
}

export async function fetchProviderJson(options: Readonly<{
  url: string;
  accessToken: string;
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
  fetchImplementation?: typeof fetch;
  attempts?: number;
  timeoutMs?: number;
}>): Promise<unknown> {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response: Response | undefined;
    try {
      const headers = new Headers({
        Accept: "application/json",
        Authorization: `Bearer ${options.accessToken}`,
      });
      if (options.body !== undefined) headers.set("Content-Type", "application/json");
      if (options.idempotencyKey !== undefined) {
        headers.set("X-Idempotency-Key", options.idempotencyKey);
      }
      response = await fetchImplementation(options.url, {
        method: options.method ?? "GET",
        headers,
        signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      const text = await response.text();
      let payload: unknown;
      try {
        payload = text === "" ? undefined : JSON.parse(text) as unknown;
      } catch (error: unknown) {
        throw new PaymentProviderError({
          message: "Mercado Pago devolvió una respuesta no válida.",
          retryable: canRetry(response),
          statusCode: response.status,
          cause: error,
        });
      }
      if (response.ok) return payload;
      if (!canRetry(response) || attempt === attempts) {
        throw new PaymentProviderError({
          message: `Mercado Pago rechazó la operación (HTTP ${response.status}).`,
          retryable: canRetry(response),
          statusCode: response.status,
        });
      }
    } catch (error: unknown) {
      lastError = error;
      if (
        error instanceof PaymentProviderError &&
        (!error.retryable || attempt === attempts)
      ) {
        throw error;
      }
      if (attempt === attempts) break;
    }
    await wait(retryDelay(attempt, response));
  }

  throw new PaymentProviderError({
    message: "Mercado Pago no está disponible temporalmente.",
    retryable: true,
    cause: lastError,
  });
}

