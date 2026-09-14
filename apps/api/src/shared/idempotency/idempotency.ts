import type { Request } from "express";
import { z } from "zod";

import { idempotencyKeySchema } from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { AppError } from "../errors/app-error.js";
import {
  hmacSha256,
  secureBufferEquals,
  stableJson,
} from "../security/fingerprint.js";
import { parseWithSchema } from "../validation/parse.js";

const idempotencyRowSchema = z.object({
  requestHash: z.instanceof(Buffer),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  responseStatus: z.number().int().nullable(),
  responseJson: z.unknown().nullable(),
});

export type IdempotentMutationResult<Body> = Readonly<{
  statusCode: number;
  body: Body;
  resourceType?: string;
  resourceId?: string;
}>;

export type IdempotencyExecution<Body> = Readonly<{
  statusCode: number;
  body: Body;
  replayed: boolean;
}>;

export function readIdempotencyKey(request: Request): string {
  const value = request.get("idempotency-key");
  if (value === undefined) {
    throw new AppError({
      statusCode: 400,
      code: "IDEMPOTENCY_KEY_REQUIRED",
      message: "Debes enviar el header Idempotency-Key.",
    });
  }
  return parseWithSchema(idempotencyKeySchema, value, "body");
}

export class IdempotencyService {
  readonly #database: PostgresDatabase;
  readonly #secret: string;

  constructor(database: PostgresDatabase, secret: string) {
    this.#database = database;
    this.#secret = secret;
  }

  async execute<Body>(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    key: string;
    operation: string;
    payload: unknown;
    requestId: string;
    responseSchema: z.ZodType<Body>;
    mutation(executor: SqlExecutor): Promise<IdempotentMutationResult<Body>>;
  }>): Promise<IdempotencyExecution<Body>> {
    const keyHash = hmacSha256(
      this.#secret,
      "idempotency-key",
      `${options.organizationId}\0${options.actorUserId}\0${options.key}`,
    );
    const requestHash = hmacSha256(
      this.#secret,
      "idempotency-request",
      stableJson({ operation: options.operation, payload: options.payload }),
    );

    return this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        `DELETE FROM idempotency_records
          WHERE organization_id = $1
            AND actor_user_id = $2
            AND key_hash = $3
            AND expires_at <= now()`,
        [options.organizationId, options.actorUserId, keyHash],
      );
      const inserted = await executor.query(
        `INSERT INTO idempotency_records
           (organization_id, actor_user_id, key_hash, request_hash,
            operation, status, original_request_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS', $6,
                 now() + interval '24 hours')
         ON CONFLICT (organization_id, actor_user_id, key_hash) DO NOTHING`,
        [
          options.organizationId,
          options.actorUserId,
          keyHash,
          requestHash,
          options.operation,
          options.requestId,
        ],
      );

      if (inserted.rowCount === 0) {
        return this.#resolveExisting<Body>(executor, {
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          keyHash,
          requestHash,
          responseSchema: options.responseSchema,
        });
      }

      const result = await options.mutation(executor);
      await executor.query(
        `UPDATE idempotency_records
            SET status = 'COMPLETED', response_status = $4,
                response_json = $5::jsonb, resource_type = $6,
                resource_id = $7
          WHERE organization_id = $1
            AND actor_user_id = $2
            AND key_hash = $3`,
        [
          options.organizationId,
          options.actorUserId,
          keyHash,
          result.statusCode,
          JSON.stringify(result.body),
          result.resourceType ?? null,
          result.resourceId ?? null,
        ],
      );
      return { statusCode: result.statusCode, body: result.body, replayed: false };
    });
  }

  async #resolveExisting<Body>(
    executor: SqlExecutor,
    input: Readonly<{
      organizationId: string;
      actorUserId: string;
      keyHash: Buffer;
      requestHash: Buffer;
      responseSchema: z.ZodType<Body>;
    }>,
  ): Promise<IdempotencyExecution<Body>> {
    const existing = await executor.query(
      `SELECT request_hash AS "requestHash", status,
              response_status AS "responseStatus",
              response_json AS "responseJson"
         FROM idempotency_records
        WHERE organization_id = $1
          AND actor_user_id = $2
          AND key_hash = $3
        FOR UPDATE`,
      [input.organizationId, input.actorUserId, input.keyHash],
    );
    const row = idempotencyRowSchema.parse(existing.rows[0]);
    if (!secureBufferEquals(row.requestHash, input.requestHash)) {
      throw new AppError({
        statusCode: 409,
        code: "IDEMPOTENCY_CONFLICT",
        message: "La clave de idempotencia ya fue usada con otra solicitud.",
      });
    }
    if (
      row.status !== "COMPLETED" ||
      row.responseStatus === null ||
      row.responseJson === null
    ) {
      throw new AppError({
        statusCode: 409,
        code: "CONFLICT",
        message: "La operación con esta clave todavía está en curso.",
      });
    }
    return {
      statusCode: row.responseStatus,
      body: input.responseSchema.parse(row.responseJson),
      replayed: true,
    };
  }
}
