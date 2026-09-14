import type { AppConfig } from "../../config/env.js";
import { FakeNotificationProvider } from "./fake-notification-provider.js";
import type { NotificationProvider } from "./notification-provider.js";
import { ResendNotificationProvider } from "./resend-notification-provider.js";

function required(value: string | undefined, name: string): string {
  if (value === undefined) throw new Error(`${name} is required for Resend.`);
  return value;
}

export function createNotificationProvider(config: AppConfig): NotificationProvider {
  if (config.emailProvider === "fake") return new FakeNotificationProvider();
  return new ResendNotificationProvider({
    apiKey: required(config.resendApiKey, "RESEND_API_KEY"),
    from: required(config.emailFrom, "EMAIL_FROM"),
    ...(config.emailReplyTo === undefined ? {} : { replyTo: config.emailReplyTo }),
  });
}
