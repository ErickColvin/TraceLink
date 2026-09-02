import {
  permissionSchema,
  roleCodeSchema,
  type AuthAudience,
  type RegisterRequest,
} from "@tracelink/contracts";
import { z } from "zod";

import {
  type PostgresDatabase,
  type SqlExecutor,
} from "../../database/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  AuthContext,
  AuthRepositoryPort,
  CreateSessionInput,
  CreatedSession,
  LoginIdentity,
} from "./auth-types.js";

const identityRowSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  passwordHash: z.string(),
  userStatus: z.enum(["ACTIVE", "INACTIVE"]),
  organizationId: z.string().uuid(),
  organizationSlug: z.string(),
  organizationName: z.string(),
  organizationActive: z.boolean(),
  customerId: z.string().uuid().nullable(),
  customerStatus: z.enum(["ACTIVE", "INACTIVE"]).nullable(),
  membershipId: z.string().uuid().nullable(),
  membershipStatus: z.enum(["ACTIVE", "INACTIVE"]).nullable(),
  roleId: z.string().uuid().nullable(),
  roleCode: roleCodeSchema.nullable(),
  roleLabel: z.string().nullable(),
  permissions: z.array(permissionSchema),
});

const sessionRowSchema = identityRowSchema.omit({ passwordHash: true }).extend({
  sessionId: z.string().uuid(),
  audience: z.enum(["CUSTOMER", "STAFF"]),
  tokenHash: z.instanceof(Buffer),
  authenticatedAt: z.date(),
  expiresAt: z.date(),
  lastSeenAt: z.date(),
});

const createdSessionRowSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  expiresAt: z.date(),
});

function toLoginIdentity(
  row: z.infer<typeof identityRowSchema>,
  audience: AuthAudience,
): LoginIdentity {
  const base = {
    user: {
      id: row.userId,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      passwordHash: row.passwordHash,
      status: row.userStatus,
    },
    organization: {
      id: row.organizationId,
      slug: row.organizationSlug,
      name: row.organizationName,
      active: row.organizationActive,
    },
  } satisfies Pick<LoginIdentity, "user" | "organization">;

  if (audience === "customer") {
    return {
      ...base,
      ...(row.customerId === null || row.customerStatus === null
        ? {}
        : { customer: { id: row.customerId, status: row.customerStatus } }),
    };
  }

  return {
    ...base,
    ...(row.membershipId === null ||
    row.membershipStatus === null ||
    row.roleId === null ||
    row.roleCode === null ||
    row.roleLabel === null
      ? {}
      : {
          membership: {
            id: row.membershipId,
            status: row.membershipStatus,
            role: {
              id: row.roleId,
              code: row.roleCode,
              label: row.roleLabel,
            },
            permissions: row.permissions,
          },
        }),
  };
}

function toAuthContext(
  row: z.infer<typeof sessionRowSchema>,
): AuthContext | null {
  const base = {
    sessionId: row.sessionId,
    sessionTokenHash: row.tokenHash,
    user: {
      id: row.userId,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
    },
    organization: {
      id: row.organizationId,
      slug: row.organizationSlug,
      name: row.organizationName,
    },
    authenticatedAt: row.authenticatedAt.toISOString(),
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
  } as const;

  if (row.audience === "CUSTOMER") {
    if (row.customerId === null || row.customerStatus !== "ACTIVE") return null;
    return {
      ...base,
      audience: "customer",
      customerId: row.customerId,
      permissions: [],
    };
  }

  if (
    row.membershipId === null ||
    row.membershipStatus !== "ACTIVE" ||
    row.roleId === null ||
    row.roleCode === null ||
    row.roleLabel === null
  ) {
    return null;
  }
  return {
    ...base,
    audience: "staff",
    membershipId: row.membershipId,
    membershipStatus: "ACTIVE",
    role: { id: row.roleId, code: row.roleCode, label: row.roleLabel },
    permissions: row.permissions,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "23505"
  );
}

export class PostgresAuthRepository implements AuthRepositoryPort {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  async findLoginIdentity(
    organizationSlug: string,
    emailNormalized: string,
    audience: AuthAudience,
  ): Promise<LoginIdentity | null> {
    const result = await this.#database.query(
      `SELECT
         u.id AS "userId", u.email, u.first_name AS "firstName",
         u.last_name AS "lastName", u.password_hash AS "passwordHash",
         u.status AS "userStatus",
         o.id AS "organizationId", o.slug AS "organizationSlug",
         o.name AS "organizationName", o.active AS "organizationActive",
         c.id AS "customerId", c.status AS "customerStatus",
         m.id AS "membershipId", m.status AS "membershipStatus",
         r.id AS "roleId", r.code AS "roleCode", r.label AS "roleLabel",
         COALESCE(p.permissions, ARRAY[]::text[]) AS permissions
       FROM organizations o
       JOIN users u ON u.email_normalized = $2
       LEFT JOIN customers c
         ON c.organization_id = o.id AND c.user_id = u.id
       LEFT JOIN memberships m
         ON m.organization_id = o.id AND m.user_id = u.id
       LEFT JOIN roles r
         ON r.organization_id = o.id AND r.id = m.role_id
       LEFT JOIN LATERAL (
         SELECT array_agg(rp.permission_key ORDER BY rp.permission_key) AS permissions
         FROM role_permissions rp
         WHERE rp.organization_id = o.id AND rp.role_id = r.id
       ) p ON true
       WHERE o.slug = $1
       LIMIT 1`,
      [organizationSlug, emailNormalized],
    );
    const raw = result.rows[0];
    if (raw === undefined) return null;
    return toLoginIdentity(identityRowSchema.parse(raw), audience);
  }

  async createSession(input: CreateSessionInput): Promise<CreatedSession> {
    return this.#createSession(this.#database, input);
  }

  async #createSession(
    executor: SqlExecutor,
    input: CreateSessionInput,
  ): Promise<CreatedSession> {
    const result = await executor.query(
      `INSERT INTO sessions
         (organization_id, user_id, audience, membership_id, customer_id,
          token_hash, created_at, expires_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7, now())
       RETURNING id, created_at AS "createdAt", expires_at AS "expiresAt"`,
      [
        input.organizationId,
        input.userId,
        input.audience.toUpperCase(),
        input.membershipId ?? null,
        input.customerId ?? null,
        input.tokenHash,
        input.expiresAt,
      ],
    );
    return createdSessionRowSchema.parse(result.rows[0]);
  }

  async resolveSession(tokenHash: Buffer): Promise<AuthContext | null> {
    const result = await this.#database.query(
      `SELECT
         s.id AS "sessionId", s.audience, s.token_hash AS "tokenHash",
         s.created_at AS "authenticatedAt", s.expires_at AS "expiresAt",
         s.last_seen_at AS "lastSeenAt",
         u.id AS "userId", u.email, u.first_name AS "firstName",
         u.last_name AS "lastName", u.status AS "userStatus",
         o.id AS "organizationId", o.slug AS "organizationSlug",
         o.name AS "organizationName", o.active AS "organizationActive",
         c.id AS "customerId", c.status AS "customerStatus",
         m.id AS "membershipId", m.status AS "membershipStatus",
         r.id AS "roleId", r.code AS "roleCode", r.label AS "roleLabel",
         COALESCE(p.permissions, ARRAY[]::text[]) AS permissions
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN organizations o ON o.id = s.organization_id
       LEFT JOIN customers c
         ON c.organization_id = s.organization_id AND c.id = s.customer_id
       LEFT JOIN memberships m
         ON m.organization_id = s.organization_id AND m.id = s.membership_id
       LEFT JOIN roles r
         ON r.organization_id = s.organization_id AND r.id = m.role_id
       LEFT JOIN LATERAL (
         SELECT array_agg(rp.permission_key ORDER BY rp.permission_key) AS permissions
         FROM role_permissions rp
         WHERE rp.organization_id = s.organization_id AND rp.role_id = r.id
       ) p ON true
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > now()
         AND u.status = 'ACTIVE'
         AND o.active = true
       LIMIT 1`,
      [tokenHash],
    );
    const raw = result.rows[0];
    if (raw === undefined) return null;
    return toAuthContext(sessionRowSchema.parse(raw));
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.#database.query(
      `UPDATE sessions SET last_seen_at = now()
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [sessionId],
    );
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.#database.query(
      `UPDATE sessions
       SET revoked_at = COALESCE(revoked_at, now()),
           revocation_reason = COALESCE(revocation_reason, $2)
       WHERE id = $1`,
      [sessionId, reason],
    );
  }

  async registerCustomer(input: Readonly<{
    organizationSlug: string;
    registration: RegisterRequest;
    passwordHash: string;
    tokenHash: Buffer;
    expiresAt: Date;
  }>): Promise<Readonly<{ identity: LoginIdentity; session: CreatedSession }>> {
    try {
      return await this.#database.sqlTransaction(async (transaction) => {
        const organizationResult = await transaction.query(
          `SELECT id, slug, name, active
           FROM organizations WHERE slug = $1 AND active = true
           FOR SHARE`,
          [input.organizationSlug],
        );
        const organization = z.object({
          id: z.string().uuid(),
          slug: z.string(),
          name: z.string(),
          active: z.literal(true),
        }).parse(organizationResult.rows[0]);

        const emailNormalized = input.registration.email.trim().toLowerCase();
        const userResult = await transaction.query(
          `INSERT INTO users
             (email, email_normalized, first_name, last_name, password_hash,
              status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', now(), now())
           RETURNING id`,
          [
            input.registration.email.trim(),
            emailNormalized,
            input.registration.firstName,
            input.registration.lastName,
            input.passwordHash,
          ],
        );
        const userId = z.object({ id: z.string().uuid() }).parse(userResult.rows[0]).id;

        const customerResult = await transaction.query(
          `INSERT INTO customers
             (organization_id, user_id, first_name, last_name, email,
              email_normalized, phone, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', now(), now())
           RETURNING id`,
          [
            organization.id,
            userId,
            input.registration.firstName,
            input.registration.lastName,
            input.registration.email.trim(),
            emailNormalized,
            input.registration.phone ?? null,
          ],
        );
        const customerId = z.object({ id: z.string().uuid() }).parse(customerResult.rows[0]).id;
        const session = await this.#createSession(transaction, {
          organizationId: organization.id,
          userId,
          audience: "customer",
          customerId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        });

        return {
          identity: {
            user: {
              id: userId,
              email: input.registration.email.trim(),
              firstName: input.registration.firstName,
              lastName: input.registration.lastName,
              passwordHash: input.passwordHash,
              status: "ACTIVE",
            },
            organization,
            customer: { id: customerId, status: "ACTIVE" },
          },
          session,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "No fue posible registrar una cuenta con esos datos.",
        });
      }
      throw error;
    }
  }
}

