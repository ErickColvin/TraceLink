import { HttpClientError } from "./http-client";

export type OperationalError = Readonly<{
  message: string;
  requestId?: string;
}>;

export function toOperationalError(
  error: unknown,
  fallbackMessage: string,
): OperationalError {
  if (error instanceof HttpClientError) {
    return {
      message: error.message,
      ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
    };
  }

  return {
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}
