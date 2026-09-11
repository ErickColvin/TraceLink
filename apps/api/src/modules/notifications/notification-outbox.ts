import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import type { NotificationProvider } from "./notification-provider.js";
import { NotificationProviderError } from "./notification-provider.js";
import {
  isNotificationEventType,
  renderNotification,
  type NotificationEventType,
} from "./notification-templates.js";

export type EnqueueNotificationInput = Readonly<{
  organizationId: string;
  eventKey: string;
  eventType: NotificationEventType;
  recipientEmail: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export async function enqueueNotification(
  executor: SqlExecutor,
  input: EnqueueNotificationInput,
): Promise<boolean> {
  const result = await executor.query(
    `INSERT INTO outbox_events
       (organization_id, event_key, event_type, recipient_email, payload,
        status, attempts, max_attempts, next_attempt_at, created_at, updated_at)
     VALUES ($1, $2, $3, lower(btrim($4)), $5::jsonb,
             'PENDING', 0, 5, now(), now(), now())
     ON CONFLICT (organization_id, event_key) DO NOTHING`,
    [
      input.organizationId,
      input.eventKey,
      input.eventType,
      input.recipientEmail,
      JSON.stringify(input.payload),
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

type ClaimedOutboxEvent = Readonly<{
  id: string;
  eventKey: string;
  eventType: string;
  recipientEmail: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}>;

export type OutboxProcessingFailure = Readonly<{
  eventId: string;
  eventType: string;
  attempt: number;
  code: string;
  terminal: boolean;
  error: unknown;
}>;

export type OutboxProcessingResult = Readonly<{
  claimed: number;
  delivered: number;
  retrying: number;
  dead: number;
}>;

function failureDetails(error: unknown): Readonly<{
  code: string;
  retryable: boolean;
}> {
  if (error instanceof NotificationProviderError) {
    return { code: error.code, retryable: error.retryable };
  }
  return { code: error instanceof Error ? error.name : "UnknownError", retryable: true };
}

export class NotificationOutboxProcessor {
  readonly #database: PostgresDatabase;
  readonly #provider: NotificationProvider;

  constructor(database: PostgresDatabase, provider: NotificationProvider) {
    this.#database = database;
    this.#provider = provider;
  }

  async process(options: Readonly<{
    limit: number;
    leaseMinutes: number;
    onFailure?: (failure: OutboxProcessingFailure) => void;
  }>): Promise<OutboxProcessingResult> {
    const events = await this.#claim(options.limit, options.leaseMinutes);
    let delivered = 0;
    let retrying = 0;
    let dead = 0;

    for (const event of events) {
      try {
        if (!isNotificationEventType(event.eventType)) {
          throw new NotificationProviderError({
            code: "UNSUPPORTED_NOTIFICATION_EVENT",
            message: "The outbox event type is not supported.",
            retryable: false,
          });
        }
        const content = renderNotification(event.eventType, event.payload);
        const delivery = await this.#provider.sendEmail({
          to: event.recipientEmail,
          ...content,
          idempotencyKey: event.eventKey,
        });
        await this.#database.query(
          `UPDATE outbox_events
              SET status = 'DELIVERED', delivered_at = now(), locked_at = NULL,
                  provider_message_id = $2, last_error = NULL, updated_at = now()
            WHERE id = $1 AND status = 'PROCESSING'`,
          [event.id, delivery.providerMessageId],
        );
        delivered += 1;
      } catch (error: unknown) {
        const failure = failureDetails(error);
        const terminal = !failure.retryable || event.attempts >= event.maxAttempts;
        const delaySeconds = Math.min(3_600, 60 * (2 ** Math.max(0, event.attempts - 1)));
        await this.#database.query(
          `UPDATE outbox_events
              SET status = $2, locked_at = NULL, last_error = $3,
                  next_attempt_at = CASE WHEN $2 = 'PENDING'
                    THEN now() + ($4 * interval '1 second') ELSE next_attempt_at END,
                  updated_at = now()
            WHERE id = $1 AND status = 'PROCESSING'`,
          [event.id, terminal ? "DEAD" : "PENDING", failure.code, delaySeconds],
        );
        if (terminal) dead += 1;
        else retrying += 1;
        options.onFailure?.({
          eventId: event.id,
          eventType: event.eventType,
          attempt: event.attempts,
          code: failure.code,
          terminal,
          error,
        });
      }
    }

    return { claimed: events.length, delivered, retrying, dead };
  }

  #claim(limit: number, leaseMinutes: number): Promise<readonly ClaimedOutboxEvent[]> {
    return this.#database.sqlTransaction(async (executor) => {
      await executor.query(
        `UPDATE outbox_events
            SET status = 'DEAD', locked_at = NULL,
                last_error = 'DELIVERY_LEASE_EXHAUSTED', updated_at = now()
          WHERE status = 'PROCESSING' AND attempts >= max_attempts
            AND locked_at <= now() - ($1 * interval '1 minute')`,
        [leaseMinutes],
      );
      const result = await executor.query<ClaimedOutboxEvent>(
        `WITH candidates AS (
           SELECT id
             FROM outbox_events
            WHERE attempts < max_attempts
              AND (
                (status = 'PENDING' AND next_attempt_at <= now())
                OR (status = 'PROCESSING'
                    AND locked_at <= now() - ($2 * interval '1 minute'))
              )
            ORDER BY next_attempt_at ASC, created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
         )
         UPDATE outbox_events event
            SET status = 'PROCESSING', locked_at = now(), attempts = attempts + 1,
                updated_at = now()
           FROM candidates
          WHERE event.id = candidates.id
         RETURNING event.id, event.event_key AS "eventKey",
                   event.event_type AS "eventType",
                   event.recipient_email AS "recipientEmail", event.payload,
                   event.attempts, event.max_attempts AS "maxAttempts"`,
        [limit, leaseMinutes],
      );
      return result.rows;
    });
  }
}
