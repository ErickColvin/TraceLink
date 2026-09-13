import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  createLogger,
  createRequestLogger,
  redactRequestUrl,
  redactSensitiveText,
  redactSensitiveValue,
} from "../../src/shared/logging/logger.js";

describe("redactSensitiveText", () => {
  it("redacts URL credentials, bearer tokens and sensitive assignments", () => {
    const result = redactSensitiveText(
      "postgresql://admin:secret@db.local/app authorization=Bearer-value Bearer abc123 password=hunter2",
    );

    expect(result).not.toContain("admin:secret");
    expect(result).not.toContain("abc123");
    expect(result).not.toContain("hunter2");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts nested session data and secrets without mutating safe fields", () => {
    const input = {
      context: {
        safe: "visible",
        session: { id: "session-id-secret", token: "opaque-session-secret" },
        credentials: {
          passwordConfirmation: "nested-password-secret",
          signingSecret: "nested-signing-secret",
        },
      },
    };

    const result = redactSensitiveValue(input);
    expect(result).toEqual({
      context: {
        safe: "visible",
        session: "[REDACTED]",
        credentials: {
          passwordConfirmation: "[REDACTED]",
          signingSecret: "[REDACTED]",
        },
      },
    });
    expect(input.context.session.token).toBe("opaque-session-secret");
  });

  it("redacts common nested aliases and encoded URL keys", () => {
    expect(
      redactSensitiveValue({
        safe: "visible",
        headers: {
          "x-api-key": "api-key-secret",
          clientAuthorization: "authorization-secret",
          requestCookie: "cookie-secret",
        },
      }),
    ).toEqual({
      safe: "visible",
      headers: {
        "x-api-key": "[REDACTED]",
        clientAuthorization: "[REDACTED]",
        requestCookie: "[REDACTED]",
      },
    });
    expect(
      redactRequestUrl(
        "/api%2Dkey/path-secret?pass%77ord=query-secret&safe=visible",
      ),
    ).toBe("/api%2Dkey/[REDACTED]?pass%77ord=[REDACTED]&safe=visible");
  });

  it("redacts JSON and URL secrets in emitted log records and messages", () => {
    const records: string[] = [];
    const logger = createLogger(
      { nodeEnv: "test", logLevel: "info" },
      { write: (message) => records.push(message) },
    );
    const structuredSecret = "structured-session-secret";
    const urlSecret = "url-query-secret";
    const jsonSecret = "json-password-secret";

    logger.info(
      {
        nested: { session: { token: structuredSecret } },
        callbackUrl: `https://user:pass@example.test/api%2Dkey/path-log-secret?client_secret=${urlSecret}&safe=yes`,
      },
      JSON.stringify({ safe: "visible", password: jsonSecret }),
    );

    const output = records.join("");
    expect(output).not.toContain(structuredSecret);
    expect(output).not.toContain("user:pass");
    expect(output).not.toContain("path-log-secret");
    expect(output).not.toContain(urlSecret);
    expect(output).not.toContain(jsonSecret);
    expect(output).toContain("visible");
    expect(output).toContain("[REDACTED]");
  });

  it("replaces circular references instead of failing log serialization", () => {
    const circular: Record<string, unknown> = { safe: "visible" };
    circular["self"] = circular;

    expect(redactSensitiveValue(circular)).toEqual({
      safe: "visible",
      self: "[CIRCULAR]",
    });
  });

  it("redacts raw and encoded secrets from actual HTTP request logs", async () => {
    const records: string[] = [];
    const logger = createLogger(
      { nodeEnv: "test", logLevel: "info" },
      { write: (message) => records.push(message) },
    );
    const app = express();
    app.use(createRequestLogger(logger));
    app.get("/{*path}", (_request, response) => response.status(204).end());

    const response = await request(app).get(
      "/c%73rf/path-secret?c%73rf=query-secret&safe=visible",
    );

    expect(response.status).toBe(204);
    const output = records.join("");
    expect(output).not.toContain("path-secret");
    expect(output).not.toContain("query-secret");
    expect(output).toContain("safe=visible");
    expect(output).toContain("[REDACTED]");
  });
});
