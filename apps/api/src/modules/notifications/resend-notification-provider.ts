import { z } from "zod";

import {
  NotificationProviderError,
  type NotificationDelivery,
  type NotificationMessage,
  type NotificationProvider,
} from "./notification-provider.js";

const resendResponseSchema = z.object({ id: z.string().trim().min(1).max(200) });

export class ResendNotificationProvider implements NotificationProvider {
  readonly code = "RESEND" as const;
  readonly #apiKey: string;
  readonly #from: string;
  readonly #replyTo: string | undefined;
  readonly #fetch: typeof fetch;

  constructor(options: Readonly<{
    apiKey: string;
    from: string;
    replyTo?: string;
    fetch?: typeof fetch;
  }>) {
    this.#apiKey = options.apiKey;
    this.#from = options.from;
    this.#replyTo = options.replyTo;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async sendEmail(message: NotificationMessage): Promise<NotificationDelivery> {
    let response: Response;
    try {
      response = await this.#fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.#from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(this.#replyTo === undefined ? {} : { reply_to: this.#replyTo }),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error: unknown) {
      throw new NotificationProviderError({
        code: "RESEND_NETWORK_ERROR",
        message: "Resend is temporarily unreachable.",
        retryable: true,
        cause: error,
      });
    }

    if (!response.ok) {
      throw new NotificationProviderError({
        code: `RESEND_HTTP_${response.status}`,
        message: "Resend rejected the email request.",
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      });
    }

    const parsed = resendResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new NotificationProviderError({
        code: "RESEND_INVALID_RESPONSE",
        message: "Resend returned an invalid response.",
        retryable: true,
      });
    }
    return { providerMessageId: parsed.data.id };
  }
}
