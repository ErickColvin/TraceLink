import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  parseEnvironment,
} from "../../src/config/env.js";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://tracelink:test@127.0.0.1:5433/tracelink_test",
  WEB_ORIGIN: "http://127.0.0.1:5173",
  SESSION_SECRET: "session-secret-for-tests-only-32-chars",
  CSRF_SECRET: "csrf-secret-for-tests-only-32-chars---",
  IDEMPOTENCY_SECRET: "idempotency-secret-for-tests-only-32",
  RATE_LIMIT_SECRET: "rate-limit-secret-for-tests-only-32--",
  PICKUP_CODE_SECRET: "pickup-code-secret-for-tests-only-32-",
} as const;

describe("parseEnvironment", () => {
  it("normalizes an exact web origin and applies bounded defaults", () => {
    const config = parseEnvironment(validEnvironment);

    expect(config.webOrigin).toBe("http://127.0.0.1:5173");
    expect(config.appEnv).toBe("local");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(3001);
    expect(config.apiPublicUrl).toBe("http://127.0.0.1:3001");
    expect(config.databasePoolMax).toBe(10);
    expect(config.databaseConnectionTimeoutMs).toBe(10_000);
    expect(config.databaseIdleTimeoutMs).toBe(30_000);
    expect(config.organizationSlug).toBe("ch-market");
    expect(config.trustProxy).toBe(false);
    expect(config.jsonBodyLimitBytes).toBe(102_400);
    expect(config.shutdownTimeoutMs).toBe(10_000);
    expect(config.paymentProvider).toBe("fake");
    expect(config.checkoutReservationMinutes).toBe(15);
    expect(config.paymentSuccessUrl).toBe(
      "http://127.0.0.1:5173/checkout/resultado",
    );
    expect(config.paymentWebhookUrl).toBe(
      "http://127.0.0.1:3001/api/v1/webhooks/mercadopago",
    );
  });

  it("requires an explicit HTTPS API URL for staging", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        NODE_ENV: "production",
        APP_ENV: "staging",
        PAYMENT_PROVIDER: "fake",
      }),
    ).toThrow(EnvironmentValidationError);

    const config = parseEnvironment({
      ...validEnvironment,
      NODE_ENV: "production",
      APP_ENV: "staging",
      PAYMENT_PROVIDER: "fake",
      WEB_ORIGIN: "https://staging.shop.example.invalid",
      API_PUBLIC_URL: "https://staging.api.example.invalid/",
    });

    expect(config.appEnv).toBe("staging");
    expect(config.host).toBe("0.0.0.0");
    expect(config.apiPublicUrl).toBe(
      "https://staging.api.example.invalid",
    );
  });

  it("rejects insecure public URLs outside local development", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        NODE_ENV: "production",
        APP_ENV: "staging",
        PAYMENT_PROVIDER: "fake",
        WEB_ORIGIN: "http://staging.shop.example.invalid",
        API_PUBLIC_URL: "http://staging.api.example.invalid",
      }),
    ).toThrow(EnvironmentValidationError);
  });

  it("rejects web origins with paths", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        WEB_ORIGIN: "http://127.0.0.1:5173/app",
      }),
    ).toThrow(EnvironmentValidationError);
  });

  it("accepts only explicit proxy hop, IP, or CIDR configurations", () => {
    expect(parseEnvironment({ ...validEnvironment, TRUST_PROXY: "1" }).trustProxy)
      .toBe(1);
    expect(
      parseEnvironment({
        ...validEnvironment,
        TRUST_PROXY: "127.0.0.1, 10.0.0.0/8, 2001:db8::/32",
      }).trustProxy,
    ).toEqual(["127.0.0.1", "10.0.0.0/8", "2001:db8::/32"]);
  });

  it.each([
    "true",
    "0",
    "proxy.internal",
    "0.0.0.0/0",
    "::/0",
    "10.0.0.0/99",
    "1.2.3.999",
  ])(
    "rejects unsafe or invalid TRUST_PROXY=%s",
    (trustProxy) => {
      expect(() =>
        parseEnvironment({ ...validEnvironment, TRUST_PROXY: trustProxy }),
      ).toThrow(EnvironmentValidationError);
    },
  );

  it("reports invalid fields without echoing secret values", () => {
    const secret = "too-short";

    try {
      parseEnvironment({ ...validEnvironment, SESSION_SECRET: secret });
      throw new Error("Expected parseEnvironment to reject the secret.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      expect(String(error)).toContain("SESSION_SECRET");
      expect(String(error)).not.toContain(secret);
    }
  });

  it("requires an explicit payment provider in production", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, NODE_ENV: "production" }),
    ).toThrow(EnvironmentValidationError);
  });

  it("requires Mercado Pago secrets and callback URLs only for Mercado Pago", () => {
    try {
      parseEnvironment({
        ...validEnvironment,
        PAYMENT_PROVIDER: "mercadopago",
      });
      throw new Error("Expected Mercado Pago configuration to be rejected.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      if (!(error instanceof EnvironmentValidationError)) return;
      expect(error.fields).toEqual(
        expect.arrayContaining([
          "MERCADOPAGO_ACCESS_TOKEN",
          "MERCADOPAGO_WEBHOOK_SECRET",
          "PAYMENT_SUCCESS_URL",
          "PAYMENT_FAILURE_URL",
          "PAYMENT_PENDING_URL",
          "PAYMENT_WEBHOOK_URL",
        ]),
      );
    }

    const configured = parseEnvironment({
      ...validEnvironment,
      PAYMENT_PROVIDER: "mercadopago",
      MERCADOPAGO_ACCESS_TOKEN: "sandbox-access-token",
      MERCADOPAGO_WEBHOOK_SECRET: "sandbox-webhook-secret",
      PAYMENT_SUCCESS_URL: "https://shop.example.invalid/checkout/resultado",
      PAYMENT_FAILURE_URL: "https://shop.example.invalid/checkout/resultado",
      PAYMENT_PENDING_URL: "https://shop.example.invalid/checkout/resultado",
      PAYMENT_WEBHOOK_URL:
        "https://api.example.invalid/api/v1/webhooks/mercadopago",
    });
    expect(configured.paymentProvider).toBe("mercadopago");
    expect(configured.mercadoPagoAccessToken).toBe("sandbox-access-token");
  });

  it("requires sender and API key only when Resend is selected", () => {
    try {
      parseEnvironment({ ...validEnvironment, EMAIL_PROVIDER: "resend" });
      throw new Error("Expected Resend configuration to be rejected.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      if (!(error instanceof EnvironmentValidationError)) return;
      expect(error.fields).toEqual(
        expect.arrayContaining(["EMAIL_FROM", "RESEND_API_KEY"]),
      );
    }

    const config = parseEnvironment({
      ...validEnvironment,
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "notificaciones@example.com",
      RESEND_API_KEY: "resend-test-key",
    });
    expect(config.emailProvider).toBe("resend");
    expect(config.emailFrom).toBe("notificaciones@example.com");
  });

  it.each(["ftp://example.invalid/callback", "not-a-url"])(
    "rejects non-HTTP payment URL %s",
    (paymentSuccessUrl) => {
      expect(() =>
        parseEnvironment({
          ...validEnvironment,
          PAYMENT_SUCCESS_URL: paymentSuccessUrl,
        }),
      ).toThrow(EnvironmentValidationError);
    },
  );

  it.each(["0", "61", "1.5"])(
    "rejects CHECKOUT_RESERVATION_MINUTES=%s outside its integer bounds",
    (checkoutReservationMinutes) => {
      expect(() =>
        parseEnvironment({
          ...validEnvironment,
          CHECKOUT_RESERVATION_MINUTES: checkoutReservationMinutes,
        }),
      ).toThrow(EnvironmentValidationError);
    },
  );
});
