import { describe, expect, it, vi } from "vitest";

import { FakeNotificationProvider } from "../../src/modules/notifications/fake-notification-provider.js";
import { ResendNotificationProvider } from "../../src/modules/notifications/resend-notification-provider.js";
import { renderNotification } from "../../src/modules/notifications/notification-templates.js";

const message = {
  to: "customer@example.com",
  subject: "Pedido",
  text: "Tu pedido está listo.",
  html: "<p>Tu pedido está listo.</p>",
  idempotencyKey: "order.ready:00000000-0000-4000-8000-000000000001",
} as const;

describe("notification providers", () => {
  it("deduplicates fake deliveries by idempotency key", async () => {
    const provider = new FakeNotificationProvider();
    const first = await provider.sendEmail(message);
    const replay = await provider.sendEmail(message);

    expect(replay).toEqual(first);
    expect(provider.messages).toHaveLength(1);
  });

  it("sends Resend requests with a provider idempotency key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new ResendNotificationProvider({
      apiKey: "resend-test-key",
      from: "notificaciones@example.com",
      fetch: fetchMock,
    });

    await expect(provider.sendEmail(message)).resolves.toEqual({
      providerMessageId: "email_123",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "idempotency-key": message.idempotencyKey,
        }),
      }),
    );
  });

  it("escapes customer-controlled template values", () => {
    const rendered = renderNotification("order.ready", {
      firstName: "<Erick>",
      orderNumber: "CH&42",
    });

    expect(rendered.text).toContain("<Erick>");
    expect(rendered.html).toContain("&lt;Erick&gt;");
    expect(rendered.html).toContain("CH&amp;42");
    expect(rendered.html).not.toContain("<Erick>");
  });
});
