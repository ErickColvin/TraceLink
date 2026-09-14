import type {
  Permission,
  RoleCode,
  StaffRoleDefinition,
  UpdateRolePermissionsRequest,
} from "@tracelink/contracts";
import {
  PERMISSIONS,
  staffRoleDefinitionSchema,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import { getRoleCatalogEntry } from "./rbac-catalog.js";

type RoleRow = Readonly<{
  id: string;
  code: RoleCode;
  label: string;
  description: string | null;
  system: boolean;
  permissions: Permission[];
}>;

const ROLE_SELECT = `
  SELECT r.id, r.code, r.label, r.description, r.system,
         COALESCE(permission_set.permissions, ARRAY[]::text[]) AS permissions
    FROM roles r
    LEFT JOIN LATERAL (
      SELECT array_agg(
               rp.permission_key
               ORDER BY array_position($2::text[], rp.permission_key)
             ) AS permissions
        FROM role_permissions rp
       WHERE rp.organization_id = r.organization_id
         AND rp.role_id = r.id
    ) permission_set ON true`;

function toRole(row: RoleRow): StaffRoleDefinition {
  return staffRoleDefinitionSchema.parse({
    id: row.id,
    code: row.code,
    label: row.label,
    description:
      row.description ?? getRoleCatalogEntry(row.code).description,
    permissions: row.permissions,
    system: row.system,
  });
}

function roleNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró el rol solicitado.",
  });
}

function protectedRole(): AppError {
  return new AppError({
    statusCode: 409,
    code: "CONFLICT",
    message: "Los permisos del rol SUPER_ADMIN están protegidos.",
  });
}

function canonicalPermissions(
  input: UpdateRolePermissionsRequest,
): Permission[] {
  const selected = new Set<Permission>(input.permissions);
  return PERMISSIONS.filter((permission) => selected.has(permission));
}

export class PostgresRoleRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  async list(organizationId: string): Promise<StaffRoleDefinition[]> {
    const result = await this.#database.query<RoleRow>(
      `${ROLE_SELECT}
       WHERE r.organization_id = $1
       ORDER BY r.system DESC, r.label ASC, r.id ASC`,
      [organizationId, PERMISSIONS],
    );
    return result.rows.map(toRole);
  }

  async getById(
    organizationId: string,
    roleId: string,
  ): Promise<StaffRoleDefinition> {
    return toRole(
      await this.#getRole(this.#database, organizationId, roleId),
    );
  }

  updatePermissions(options: Readonly<{
    organizationId: string;
    roleId: string;
    actorUserId: string;
    input: UpdateRolePermissionsRequest;
    requestId: string;
  }>): Promise<StaffRoleDefinition> {
    return this.#database.sqlTransaction(async (executor) => {
      const current = await this.#lockRole(
        executor,
        options.organizationId,
        options.roleId,
      );
      if (current.code === "SUPER_ADMIN") throw protectedRole();

      const permissions = canonicalPermissions(options.input);
      await executor.query(
        `DELETE FROM role_permissions
          WHERE organization_id = $1 AND role_id = $2`,
        [options.organizationId, options.roleId],
      );
      if (permissions.length > 0) {
        const inserted = await executor.query(
          `INSERT INTO role_permissions
             (organization_id, role_id, permission_key)
           SELECT $1, $2, permission.key
             FROM unnest($3::text[]) requested(key)
             JOIN permissions permission ON permission.key = requested.key`,
          [options.organizationId, options.roleId, permissions],
        );
        if (inserted.rowCount !== permissions.length) {
          throw new Error(
            "The permission catalog is incomplete in the database.",
          );
        }
      }

      const updated = toRole(
        await this.#getRole(
          executor,
          options.organizationId,
          options.roleId,
        ),
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "role.permissions.update",
        entityType: "Role",
        entityId: options.roleId,
        before: toRole(current),
        after: updated,
        requestId: options.requestId,
      });
      return updated;
    });
  }

  async #getRole(
    executor: SqlExecutor,
    organizationId: string,
    roleId: string,
  ): Promise<RoleRow> {
    const result = await executor.query<RoleRow>(
      `${ROLE_SELECT}
       WHERE r.organization_id = $1 AND r.id = $3
       LIMIT 1`,
      [organizationId, PERMISSIONS, roleId],
    );
    const role = result.rows[0];
    if (role === undefined) throw roleNotFound();
    return role;
  }

  async #lockRole(
    executor: SqlExecutor,
    organizationId: string,
    roleId: string,
  ): Promise<RoleRow> {
    const result = await executor.query<RoleRow>(
      `${ROLE_SELECT}
       WHERE r.organization_id = $1 AND r.id = $3
       FOR UPDATE OF r`,
      [organizationId, PERMISSIONS, roleId],
    );
    const role = result.rows[0];
    if (role === undefined) throw roleNotFound();
    return role;
  }
}
