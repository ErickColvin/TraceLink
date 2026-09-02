import type { SqlExecutor } from "../../database/index.js";

export type AuditInput = Readonly<{
  organizationId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  requestId: string;
}>;

export async function writeAudit(
  executor: SqlExecutor,
  input: AuditInput,
): Promise<void> {
  await executor.query(
    `INSERT INTO audit_logs
       (organization_id, actor_user_id, action, entity_type, entity_id,
        before_json, after_json, request_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [
      input.organizationId,
      input.actorUserId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.requestId,
    ],
  );
}
