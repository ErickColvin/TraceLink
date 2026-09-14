export class PaymentProviderError extends Error {
  readonly retryable: boolean;
  readonly statusCode: number | undefined;

  constructor(options: Readonly<{
    message: string;
    retryable: boolean;
    statusCode?: number;
    cause?: unknown;
  }>) {
    super(options.message, { cause: options.cause });
    this.name = "PaymentProviderError";
    this.retryable = options.retryable;
    this.statusCode = options.statusCode;
  }
}

