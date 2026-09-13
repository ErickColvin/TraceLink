import type {
  RoleCode,
  StaffUser,
  StaffUserListParams,
  StaffUserPage,
  StaffUserStatus,
  UpdateStaffUserAccessRequest,
} from "@tracelink/contracts";
import {
  staffUserPageSchema,
  staffUserSchema,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  paginationMetadata,
  resolvePagination,
} from "../../shared/pagination/pagination.js";

type StaffUserRow = Readonly<{
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: StaffUserStatus;
  roleId: string;
  roleCode: RoleCode;
  lastAccessAt: Date | null;
  createdAt: Date;
}>;

type RoleRow = Readonly<{
  id: string;
  code: RoleCode;
}>;

type CountRow = Readonly<{ total: number }>;
type IdRow = Readonly<{ id: string }>;

const STAFF_USER_SELECT = `
  SELECT m.id,
         m.user_id AS "userId",
         u.first_name AS "firstName",
         u.last_name AS "lastName",
         u.email,
         m.status,
         m.role_id AS "roleId",
         r.code AS "roleCode",
         access."lastAccessAt",
         m.created_at AS "createdAt"
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    JOIN roles r
      ON r.organization_id = m.organization_id AND r.id = m.role_id
    LEFT JOIN LATERAL (
      SELECT MAX(s.last_seen_at) AS "lastAccessAt"
        FROM sessions s
       WHERE s.organization_id = m.organization_id
         AND s.membership_id = m.id
    ) access ON true`;

function addValue(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function toStaffUser(row: StaffUserRow): StaffUser {
  return staffUserSchema.parse({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    status: row.status,
    roleId: row.roleId,
    ...(row.lastAccessAt === null
      ? {}
      : { lastAccessAt: row.lastAccessAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
  });
}

function membershipNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró la membresía solicitada.",
  });
}

function roleNotFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró el rol solicitado en esta organización.",
  });
}

function lastSuperAdminConflict(): AppError {
  return new AppError({
    statusCode: 409,
    code: "CONFLICT",
    message: "La organización debe conservar al menos un SUPER_ADMIN activo.",
  });
}

export class PostgresUserRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  async list(
    organizationId: string,
    params: StaffUserListParams,
  ): Promise<StaffUserPage> {
    const pagination = resolvePagination(params, 10);
    const values: unknown[] = [organizationId];
    const conditions = ["m.organization_id = $1"];

    if (params.search !== undefined) {
      const search = addValue(values, `%${params.search}%`);
      conditions.push(
        `(u.first_name ILIKE ${search} OR u.last_name ILIKE ${search} ` +
          `OR u.email ILIKE ${search} ` +
          `OR concat_ws(' ', u.first_name, u.last_name) ILIKE ${search})`,
      );
    }
    if (params.status !== undefined) {
      conditions.push(`m.status = ${addValue(values, params.status)}`);
    }
    if (params.roleId !== undefined) {
      conditions.push(`m.role_id = ${addValue(values, params.roleId)}`);
    }

    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const filterValues = [...values];
    const limit = addValue(values, pagination.limit);
    const offset = addValue(values, pagination.offset);
    const [users, count] = await Promise.all([
      this.#database.query<StaffUserRow>(
        `${STAFF_USER_SELECT}
         ${whereSql}
         ORDER BY u.first_name ASC, u.last_name ASC, m.id ASC
         LIMIT ${limit} OFFSET ${offset}`,
        values,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total
           FROM memberships m
           JOIN users u ON u.id = m.user_id
          ${whereSql}`,
        filterValues,
      ),
    ]);
    const totalItems = count.rows[0]?.total ?? 0;

    return staffUserPageSchema.parse({
      items: users.rows.map(toStaffUser),
      ...paginationMetadata(pagination, totalItems),
    });
  }

  getById(organizationId: string, membershipId: string): Promise<StaffUser> {
    return this.#getById(this.#database, organizationId, membershipId);
  }

  updateAccess(options: Readonly<{
    organizationId: string;
    membershipId: string;
    actorUserId: string;
    input: UpdateStaffUserAccessRequest;
    requestId: string;
  }>): Promise<StaffUser> {
    return this.#database.sqlTransaction(async (executor) => {
      const current = await this.#lockMembership(
        executor,
        options.organizationId,
        options.membershipId,
      );
      const targetRole = await this.#getRole(
        executor,
        options.organizationId,
        options.input.roleId,
      );

      const removesSuperAdmin =
        current.roleCode === "SUPER_ADMIN" &&
        (options.input.status === "INACTIVE" ||
          targetRole.code !== "SUPER_ADMIN");
      if (removesSuperAdmin) {
        await this.#assertAnotherActiveSuperAdmin(
          executor,
          options.organizationId,
          options.membershipId,
        );
      }

      await executor.query(
        `UPDATE memberships
            SET status = $3, role_id = $4, updated_at = now()
          WHERE organization_id = $1 AND id = $2`,
        [
          options.organizationId,
          options.membershipId,
          options.input.status,
          targetRole.id,
        ],
      );

      if (options.input.status === "INACTIVE") {
        await executor.query(
          `UPDATE sessions
              SET revoked_at = COALESCE(revoked_at, now()),
                  revocation_reason = COALESCE(
                    revocation_reason,
                    'membership_disabled'
                  )
            WHERE organization_id = $1 AND membership_id = $2
              AND revoked_at IS NULL`,
          [options.organizationId, options.membershipId],
        );
      }

      const updated = await this.#getById(
        executor,
        options.organizationId,
        options.membershipId,
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: "staff_user.access.update",
        entityType: "Membership",
        entityId: options.membershipId,
        before: toStaffUser(current),
        after: updated,
        requestId: options.requestId,
      });
      return updated;
    });
  }

  async #getById(
    executor: SqlExecutor,
    organizationId: string,
    membershipId: string,
  ): Promise<StaffUser> {
    const result = await executor.query<StaffUserRow>(
      `${STAFF_USER_SELECT}
       WHERE m.organization_id = $1 AND m.id = $2
       LIMIT 1`,
      [organizationId, membershipId],
    );
    const row = result.rows[0];
    if (row === undefined) throw membershipNotFound();
    return toStaffUser(row);
  }

  async #lockMembership(
    executor: SqlExecutor,
    organizationId: string,
    membershipId: string,
  ): Promise<StaffUserRow> {
    const result = await executor.query<StaffUserRow>(
      `${STAFF_USER_SELECT}
       WHERE m.organization_id = $1 AND m.id = $2
       FOR UPDATE OF m`,
      [organizationId, membershipId],
    );
    const row = result.rows[0];
    if (row === undefined) throw membershipNotFound();
    return row;
  }

  async #getRole(
    executor: SqlExecutor,
    organizationId: string,
    roleId: string,
  ): Promise<RoleRow> {
    const result = await executor.query<RoleRow>(
      `SELECT id, code
         FROM roles
        WHERE organization_id = $1 AND id = $2
        LIMIT 1`,
      [organizationId, roleId],
    );
    const role = result.rows[0];
    if (role === undefined) throw roleNotFound();
    return role;
  }

  async #assertAnotherActiveSuperAdmin(
    executor: SqlExecutor,
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    const result = await executor.query<IdRow>(
      `SELECT m.id
         FROM memberships m
         JOIN roles r
           ON r.organization_id = m.organization_id AND r.id = m.role_id
        WHERE m.organization_id = $1
          AND m.status = 'ACTIVE'
          AND r.code = 'SUPER_ADMIN'
        FOR UPDATE OF m`,
      [organizationId],
    );
    if (!result.rows.some((row) => row.id !== membershipId)) {
      throw lastSuperAdminConflict();
    }
  }
}
