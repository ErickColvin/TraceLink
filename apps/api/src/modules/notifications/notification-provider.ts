export type NotificationMessage = Readonly<{
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}>;

export type NotificationDelivery = Readonly<{
  providerMessageId: string;
}>;

export interface NotificationProvider {
  readonly code: "FAKE" | "RESEND";
  sendEmail(message: NotificationMessage): Promise<NotificationDelivery>;
}

export class NotificationProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(options: Readonly<{
    code: string;
    message: string;
    retryable: boolean;
    cause?: unknown;
  }>) {
    super(options.message, options.cause === undefined ? {} : { cause: options.cause });
    this.name = "NotificationProviderError";
    this.code = options.code;
    this.retryable = options.retryable;
  }
}
