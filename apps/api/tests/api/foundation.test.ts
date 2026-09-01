import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { createTestConfig } from "../support/test-config.js";

const config = createTestConfig();
const logger = pino({ level: "silent" });

function createTestApp(readinessCheck: () => Promise<void> = async () => {}) {
  return createApp({ config, logger, readinessCheck });
}

describe("API foundation", () => {
  it("reports liveness without querying readiness", async () => {
    const response = await request(
      createTestApp(async () => {
        throw new Error("should not run");
      }),
    ).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      checks: { application: "up" },
    });
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("reports readiness when the database probe succeeds", async () => {
    const response = await request(createTestApp()).get(
      "/api/v1/health/ready",
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ready",
      checks: { application: "up", database: "up" },
    });
  });

  it("reports a sanitized degraded state when the database probe fails", async () => {
    const response = await request(
      createTestApp(async () => {
        throw new Error("postgresql://admin:secret@database/private");
      }),
    ).get("/api/v1/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: "degraded",
      checks: { application: "up", database: "down" },
    });
    expect(response.text).not.toContain("admin");
    expect(response.text).not.toContain("secret");
  });

  it("honors a valid upstream request id", async () => {
    const response = await request(createTestApp())
      .get("/api/v1/health/live")
      .set("X-Request-ID", "gateway:req-42");

    expect(response.headers["x-request-id"]).toBe("gateway:req-42");
    expect(response.body.requestId).toBe("gateway:req-42");
  });

  it("allows CORS only for the exact configured origin", async () => {
    const allowed = await request(createTestApp())
      .options("/api/v1/health/live")
      .set("Origin", config.webOrigin)
      .set("Access-Control-Request-Method", "GET");

    expect(allowed.status).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      config.webOrigin,
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    expect(allowed.headers["access-control-expose-headers"]).toBe(
      "X-Request-ID,Idempotency-Replayed,Retry-After",
    );

    const rejected = await request(createTestApp())
      .get("/api/v1/health/live")
      .set("Origin", "http://localhost:5173");

    expect(rejected.status).toBe(200);
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
    expect(rejected.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(rejected.headers["access-control-expose-headers"]).toBeUndefined();
  });

  it("rejects mutating requests with a missing origin", async () => {
    const response = await request(createTestApp()).post("/missing").send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });

  it.each([
    "http://localhost:5173",
    `${config.webOrigin}/`,
    `${config.webOrigin}.example.com`,
  ])(
    "rejects a mutating request from non-exact origin %s with a stable error",
    async (origin) => {
      const response = await request(createTestApp())
        .post("/missing")
        .set("Origin", origin)
        .send({});

      expect(response.status).toBe(403);
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(response.body).toEqual({
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "El origen de la solicitud no está autorizado.",
        },
        requestId: response.headers["x-request-id"],
      });
    },
  );

  it("keeps the standard error envelope after CORS accepts a mutation", async () => {
    const response = await request(createTestApp())
      .post("/missing")
      .set("Origin", config.webOrigin)
      .send({});

    expect(response.status).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBe(
      config.webOrigin,
    );
    expect(response.body).toMatchObject({
      error: { code: "NOT_FOUND" },
      requestId: response.headers["x-request-id"],
    });
  });

  it("normalizes malformed JSON and oversized payload errors", async () => {
    const invalidJson = await request(createTestApp())
      .post("/missing")
      .set("Origin", config.webOrigin)
      .set("Content-Type", "application/json")
      .send('{"invalid":');

    expect(invalidJson.status).toBe(400);
    expect(invalidJson.body.error.code).toBe("INVALID_JSON");

    const oversized = await request(createTestApp())
      .post("/missing")
      .set("Origin", config.webOrigin)
      .send({ value: "x".repeat(config.jsonBodyLimitBytes + 1) });

    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("uses the standard error envelope for unknown routes", async () => {
    const response = await request(createTestApp()).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: { code: "NOT_FOUND" },
      requestId: response.headers["x-request-id"],
    });
  });
});
