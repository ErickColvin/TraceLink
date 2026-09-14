import { createHash } from "node:crypto";

import type {
  NotificationDelivery,
  NotificationMessage,
  NotificationProvider,
} from "./notification-provider.js";

export class FakeNotificationProvider implements NotificationProvider {
  readonly code = "FAKE" as const;
  readonly messages: NotificationMessage[] = [];
  readonly #deliveries = new Map<string, NotificationDelivery>();

  sendEmail(message: NotificationMessage): Promise<NotificationDelivery> {
    const existing = this.#deliveries.get(message.idempotencyKey);
    if (existing !== undefined) return Promise.resolve(existing);

    const delivery = {
      providerMessageId: `fake-${createHash("sha256")
        .update(message.idempotencyKey)
        .digest("hex")
        .slice(0, 24)}`,
    };
    this.messages.push(message);
    this.#deliveries.set(message.idempotencyKey, delivery);
    return Promise.resolve(delivery);
  }
}
