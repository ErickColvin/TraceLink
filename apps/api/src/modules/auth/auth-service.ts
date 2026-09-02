import {
  authSessionEnvelopeSchema,
  type AuthAudience,
  type AuthSessionEnvelope,
  type RegisterRequest,
  type SignInRequest,
} from "@tracelink/contracts";

import { AppError } from "../../shared/errors/app-error.js";
import { createCsrfToken } from "../../shared/security/csrf-token.js";
import {
  hashPassword,
  verifyPasswordWithoutEnumeration,
} from "../../shared/security/password.js";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../shared/security/session-token.js";
import type {
  AuthContext,
  AuthRepositoryPort,
  AuthResult,
  AuthServicePort,
  CreatedSession,
  LoginIdentity,
} from "./auth-types.js";

export type AuthServiceOptions = Readonly<{
  repository: AuthRepositoryPort;
  organizationSlug: string;
  sessionSecret: string;
  csrfSecret: string;
  sessionTtlSeconds: number;
}>;

function invalidCredentials(): AppError {
  return new AppError({
    statusCode: 401,
    code: "INVALID_CREDENTIALS",
    message: "El correo, la contraseña o el portal no son válidos.",
  });
}

function accountDisabled(): AppError {
  return new AppError({
    statusCode: 403,
    code: "ACCOUNT_DISABLED",
    message: "La cuenta no se encuentra habilitada.",
  });
}

function buildEnvelope(
  identity: LoginIdentity,
  audience: AuthAudience,
  session: CreatedSession,
  tokenHash: Buffer,
  csrfSecret: string,
): AuthSessionEnvelope {
  const common = {
    user: {
      id: identity.user.id,
      email: identity.user.email,
      firstName: identity.user.firstName,
      lastName: identity.user.lastName,
    },
    organization: {
      id: identity.organization.id,
      slug: identity.organization.slug,
      name: identity.organization.name,
    },
    authenticatedAt: session.createdAt.toISOString(),
  } as const;
  const csrfToken = createCsrfToken(
    csrfSecret,
    session.id,
    tokenHash,
  );

  if (audience === "customer") {
    if (identity.customer === undefined) throw invalidCredentials();
    return authSessionEnvelopeSchema.parse({
      session: {
        ...common,
        audience: "customer",
        customer: { id: identity.customer.id },
        permissions: [],
      },
      csrfToken,
    });
  }

  if (identity.membership === undefined) throw invalidCredentials();
  return authSessionEnvelopeSchema.parse({
    session: {
      ...common,
      audience: "staff",
      membership: {
        id: identity.membership.id,
        status:
          identity.membership.status === "ACTIVE" ? "ACTIVE" : "DISABLED",
      },
      role: {
        id: identity.membership.role.id,
        code: identity.membership.role.code,
        name: identity.membership.role.label,
      },
      permissions: identity.membership.permissions,
    },
    csrfToken,
  });
}

export class AuthService implements AuthServicePort {
  readonly #repository: AuthRepositoryPort;
  readonly #organizationSlug: string;
  readonly #sessionSecret: string;
  readonly #csrfSecret: string;
  readonly #sessionTtlSeconds: number;

  constructor(options: AuthServiceOptions) {
    this.#repository = options.repository;
    this.#organizationSlug = options.organizationSlug;
    this.#sessionSecret = options.sessionSecret;
    this.#csrfSecret = options.csrfSecret;
    this.#sessionTtlSeconds = options.sessionTtlSeconds;
  }

  async signIn(input: SignInRequest): Promise<AuthResult> {
    const identity = await this.#repository.findLoginIdentity(
      this.#organizationSlug,
      input.email.trim().toLowerCase(),
      input.audience,
    );
    const passwordMatches = await verifyPasswordWithoutEnumeration(
      identity?.user.passwordHash,
      input.password,
    );
    if (identity === null || !passwordMatches) throw invalidCredentials();

    const audienceIdentity =
      input.audience === "customer" ? identity.customer : identity.membership;
    if (audienceIdentity === undefined) throw invalidCredentials();
    if (
      !identity.organization.active ||
      identity.user.status !== "ACTIVE" ||
      audienceIdentity.status !== "ACTIVE"
    ) {
      throw accountDisabled();
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(this.#sessionSecret, sessionToken);
    const expiresAt = new Date(Date.now() + this.#sessionTtlSeconds * 1_000);
    let session: CreatedSession;
    if (input.audience === "customer") {
      if (identity.customer === undefined) throw invalidCredentials();
      session = await this.#repository.createSession({
        organizationId: identity.organization.id,
        userId: identity.user.id,
        audience: "customer",
        customerId: identity.customer.id,
        tokenHash,
        expiresAt,
      });
    } else {
      if (identity.membership === undefined) throw invalidCredentials();
      session = await this.#repository.createSession({
        organizationId: identity.organization.id,
        userId: identity.user.id,
        audience: "staff",
        membershipId: identity.membership.id,
        tokenHash,
        expiresAt,
      });
    }

    return {
      envelope: buildEnvelope(
        identity,
        input.audience,
        session,
        tokenHash,
        this.#csrfSecret,
      ),
      sessionToken,
    };
  }

  async register(input: RegisterRequest): Promise<AuthResult> {
    const passwordHash = await hashPassword(input.password);
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(this.#sessionSecret, sessionToken);
    const expiresAt = new Date(Date.now() + this.#sessionTtlSeconds * 1_000);
    const result = await this.#repository.registerCustomer({
      organizationSlug: this.#organizationSlug,
      registration: input,
      passwordHash,
      tokenHash,
      expiresAt,
    });

    return {
      envelope: buildEnvelope(
        result.identity,
        "customer",
        result.session,
        tokenHash,
        this.#csrfSecret,
      ),
      sessionToken,
    };
  }

  getSession(context: AuthContext): AuthSessionEnvelope {
    const common = {
      user: context.user,
      organization: context.organization,
      authenticatedAt: context.authenticatedAt,
    } as const;
    const csrfToken = createCsrfToken(
      this.#csrfSecret,
      context.sessionId,
      context.sessionTokenHash,
    );

    if (context.audience === "customer") {
      return authSessionEnvelopeSchema.parse({
        session: {
          ...common,
          audience: "customer",
          customer: { id: context.customerId },
          permissions: [],
        },
        csrfToken,
      });
    }

    return authSessionEnvelopeSchema.parse({
      session: {
        ...common,
        audience: "staff",
        membership: {
          id: context.membershipId,
          status: context.membershipStatus,
        },
        role: {
          id: context.role.id,
          code: context.role.code,
          name: context.role.label,
        },
        permissions: context.permissions,
      },
      csrfToken,
    });
  }

  async signOut(context: AuthContext): Promise<void> {
    await this.#repository.revokeSession(context.sessionId, "logout");
  }
}
