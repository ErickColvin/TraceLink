export type AppErrorOptions = Readonly<{
  statusCode: number;
  code: string;
  message: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  cause?: unknown;
}>;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>> | undefined;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
  }
}
