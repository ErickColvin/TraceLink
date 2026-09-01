export type AppErrorOptions = Readonly<{
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  cause?: unknown;
}>;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}
