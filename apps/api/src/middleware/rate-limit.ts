import type { RequestHandler } from "express";
import { z } from "zod";

import type { PostgresDatabase } from "../database/index.js";
import { AppError } from "../shared/errors/app-error.js";
import { hmacSha256 } from "../shared/security/fingerprint.js";

const rateLimitRowSchema = z.object({
  count: z.number().int().nonnegative(),
  blockedUntil: z.date().nullable(),
});

export class PersistentRateLimiter {
  readonly #database: PostgresDatabase;
  readonly #secret: string;

  constructor(database: PostgresDatabase, secret: string) {
    this.#database = database;
    this.#secret = secret;
  }

  async consume(options: Readonly<{
    scope: string;
    key: string;
    maxAttempts: number;
    windowSeconds: number;
    blockSeconds: number;
  }>): Promise<Readonly<{ allowed: boolean; retryAfterSeconds?: number }>> {
    const keyHash = hmacSha256(this.#secret, "rate-limit", options.key);
    const result = await this.#database.query(
      `INSERT INTO rate_limit_buckets
         (scope, key_hash, window_started_at, count, blocked_until,
          expires_at, updated_at)
       VALUES ($1, $2, now(), 1, NULL,
               now() + ($4 * interval '1 second'), now())
       ON CONFLICT (scope, key_hash) DO UPDATE SET
         count = CASE
           WHEN rate_limit_buckets.window_started_at < now() - ($3 * interval '1 second')
             THEN 1
           ELSE rate_limit_buckets.count + 1
         END,
         window_started_at = CASE
           WHEN rate_limit_buckets.window_started_at < now() - ($3 * interval '1 second')
             THEN now()
           ELSE rate_limit_buckets.window_started_at
         END,
         blocked_until = CASE
           WHEN rate_limit_buckets.blocked_until > now()
             THEN rate_limit_buckets.blocked_until
           WHEN (CASE
             WHEN rate_limit_buckets.window_started_at < now() - ($3 * interval '1 second')
               THEN 1
             ELSE rate_limit_buckets.count + 1
           END) > $5
             THEN now() + ($6 * interval '1 second')
           ELSE NULL
         END,
         expires_at = now() + (($3 + $6) * interval '1 second'),
         updated_at = now()
       RETURNING count, blocked_until AS "blockedUntil"`,
      [
        options.scope,
        keyHash,
        options.windowSeconds,
        options.windowSeconds + options.blockSeconds,
        options.maxAttempts,
        options.blockSeconds,
      ],
    );
    const row = rateLimitRowSchema.parse(result.rows[0]);
    if (row.blockedUntil === null || row.blockedUntil.getTime() <= Date.now()) {
      return { allowed: true };
    }
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((row.blockedUntil.getTime() - Date.now()) / 1_000),
      ),
    };
  }

  async reset(options: Readonly<{ scope: string; key: string }>): Promise<void> {
    const keyHash = hmacSha256(this.#secret, "rate-limit", options.key);
    await this.#database.query(
      `DELETE FROM rate_limit_buckets WHERE scope = $1 AND key_hash = $2`,
      [options.scope, keyHash],
    );
  }
}

export function authRateLimitKey(
  request: Parameters<RequestHandler>[0],
): string {
  const body = request.body;
  const emailValue =
    typeof body === "object" && body !== null
      ? Reflect.get(body, "email")
      : undefined;
  const email =
    typeof emailValue === "string"
      ? emailValue.trim().toLowerCase()
      : "invalid";
  return `${request.ip}|${email}`;
}

export function createAuthRateLimit(options: Readonly<{
  limiter: PersistentRateLimiter;
  scope: "auth.login" | "auth.register";
  maxAttempts?: number;
  windowSeconds?: number;
  blockSeconds?: number;
}>): RequestHandler {
  return async (request, response, next) => {
    try {
      const outcome = await options.limiter.consume({
        scope: options.scope,
        key: authRateLimitKey(request),
        maxAttempts: options.maxAttempts ?? 5,
        windowSeconds: options.windowSeconds ?? 15 * 60,
        blockSeconds: options.blockSeconds ?? 15 * 60,
      });
      if (!outcome.allowed) {
        response.setHeader("Retry-After", outcome.retryAfterSeconds ?? 1);
        throw new AppError({
          statusCode: 429,
          code: "RATE_LIMITED",
          message: "Demasiados intentos. Intenta nuevamente más tarde.",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
