import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { AuthService } from "../../src/modules/auth/auth-service.js";
import type {
  AuthContext,
  AuthRepositoryPort,
  LoginIdentity,
} from "../../src/modules/auth/auth-types.js";
import { hashPassword } from "../../src/shared/security/password.js";

let passwordHash = "";

beforeAll(async () => {
  passwordHash = await hashPassword("correct-password-123");
});

function customerIdentity(
  overrides: Partial<LoginIdentity> = {},
): LoginIdentity {
  return {
    user: {
      id: randomUUID(),
      email: "customer@example.com",
      firstName: "Cliente",
      lastName: "Prueba",
      passwordHash,
      status: "ACTIVE",
    },
    organization: {
      id: randomUUID(),
      slug: "ch-market",
      name: "CH Market",
      active: true,
    },
    customer: { id: randomUUID(), status: "ACTIVE" },
    ...overrides,
  };
}

function createRepository(identity: LoginIdentity | null): AuthRepositoryPort {
  return {
    findLoginIdentity: vi.fn(async () => identity),
    createSession: vi.fn(async () => ({
      id: randomUUID(),
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
      expiresAt: new Date("2026-09-01T20:00:00.000Z"),
    })),
    resolveSession: vi.fn(async () => null),
    touchSession: vi.fn(async () => undefined),
    revokeSession: vi.fn(async () => undefined),
    registerCustomer: vi.fn(async (input) => ({
      identity: customerIdentity({
        user: {
          id: randomUUID(),
          email: input.registration.email,
          firstName: input.registration.firstName,
          lastName: input.registration.lastName,
          passwordHash: input.passwordHash,
          status: "ACTIVE",
        },
      }),
      session: {
        id: randomUUID(),
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        expiresAt: input.expiresAt,
      },
    })),
  };
}

function createService(repository: AuthRepositoryPort): AuthService {
  return new AuthService({
    repository,
    organizationSlug: "ch-market",
    sessionSecret: "session-secret-for-unit-tests-at-least-32",
    csrfSecret: "csrf-secret-for-unit-tests-at-least-32---",
    sessionTtlSeconds: 28_800,
  });
}

describe("AuthService", () => {
  it("creates a customer session without exposing its opaque token in JSON", async () => {
    const repository = createRepository(customerIdentity());
    const result = await createService(repository).signIn({
      audience: "customer",
      email: "CUSTOMER@example.com",
      password: "correct-password-123",
    });

    expect(result.sessionToken).toMatch(/^v1\./);
    expect(result.envelope.session.audience).toBe("customer");
    expect(result.envelope.csrfToken).toMatch(/^v1\./);
    expect(JSON.stringify(result.envelope)).not.toContain(result.sessionToken);
    expect(repository.findLoginIdentity).toHaveBeenCalledWith(
      "ch-market",
      "customer@example.com",
      "customer",
    );
  });

  it("returns the same generic error for missing identities and wrong passwords", async () => {
    const missing = createService(createRepository(null)).signIn({
      audience: "customer",
      email: "missing@example.com",
      password: "wrong-password",
    });
    const wrong = createService(createRepository(customerIdentity())).signIn({
      audience: "customer",
      email: "customer@example.com",
      password: "wrong-password",
    });

    await Promise.all([
      expect(missing).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      }),
      expect(wrong).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      }),
    ]);
  });

  it("rejects a disabled customer after validating the password", async () => {
    const identity = customerIdentity({
      customer: { id: randomUUID(), status: "INACTIVE" },
    });
    await expect(
      createService(createRepository(identity)).signIn({
        audience: "customer",
        email: identity.user.email,
        password: "correct-password-123",
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "ACCOUNT_DISABLED" });
  });

  it("registers only the customer shape and revokes the current session on logout", async () => {
    const repository = createRepository(null);
    const service = createService(repository);
    const result = await service.register({
      firstName: "Nueva",
      lastName: "Cliente",
      email: "new@example.com",
      password: "registered-password-123",
      phone: "+56912345678",
    });
    expect(result.envelope.session.audience).toBe("customer");

    const context: AuthContext = {
      sessionId: randomUUID(),
      sessionTokenHash: Buffer.alloc(32, 1),
      audience: "customer",
      customerId: randomUUID(),
      permissions: [],
      user: {
        id: randomUUID(),
        email: "new@example.com",
        firstName: "Nueva",
        lastName: "Cliente",
      },
      organization: {
        id: randomUUID(),
        slug: "ch-market",
        name: "CH Market",
      },
      authenticatedAt: "2026-09-01T12:00:00.000Z",
      expiresAt: new Date("2026-09-01T20:00:00.000Z"),
      lastSeenAt: new Date("2026-09-01T12:00:00.000Z"),
    };
    await service.signOut(context);
    expect(repository.revokeSession).toHaveBeenCalledWith(
      context.sessionId,
      "logout",
    );
  });
});
