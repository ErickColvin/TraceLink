import {
  authSessionEnvelopeSchema,
  type AuthMeResponse,
  type AuthSessionEnvelope,
} from "@tracelink/contracts";

import {
  ANONYMOUS_SESSION,
  type AuthAudience,
  type AuthenticatedSession,
  type AuthSession,
  type SignInCredentials,
} from "../model/auth";
import { HttpClient, HttpClientError } from "../../../lib/http/http-client";
import { AuthError, type AuthErrorCode, type AuthService } from "./auth-service";

function toFrontendSession(session: AuthMeResponse): AuthenticatedSession {
  if (session.audience === "customer") {
    return {
      kind: "customer",
      authSource: "remote",
      authenticatedAt: session.authenticatedAt,
      customer: {
        id: session.user.id,
        customerId: session.customer.id,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
      },
    };
  }

  return {
    kind: "staff",
    authSource: "remote",
    authenticatedAt: session.authenticatedAt,
    staff: {
      id: session.user.id,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      email: session.user.email,
      role: session.role.code,
      roleLabel: session.role.name,
    },
    permissions: session.permissions,
  };
}

function authErrorCode(error: HttpClientError): AuthErrorCode {
  switch (error.code) {
    case "ACCOUNT_DISABLED":
    case "INVALID_CREDENTIALS":
    case "RATE_LIMITED":
    case "SESSION_EXPIRED":
      return error.code;
    case "CSRF_INVALID":
    case "CSRF_TOKEN_UNAVAILABLE":
    case "FORBIDDEN":
    case "ORIGIN_NOT_ALLOWED":
      return "FORBIDDEN";
    case "DATABASE_UNAVAILABLE":
    case "NETWORK_ERROR":
      return "SESSION_UNAVAILABLE";
    default:
      return "UNKNOWN";
  }
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  if (error instanceof HttpClientError) {
    return new AuthError(authErrorCode(error), error.message);
  }

  return new AuthError(
    "UNKNOWN",
    "No pudimos completar la operación. Intenta nuevamente.",
  );
}

export class HttpAuthService implements AuthService {
  readonly demoSessionsEnabled = false;
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  async getSession(): Promise<AuthSession> {
    try {
      const envelope = await this.#getSessionEnvelope("/auth/me");
      return toFrontendSession(envelope.session);
    } catch (error: unknown) {
      if (error instanceof HttpClientError && error.status === 401) {
        this.#client.clearCsrfToken();
        return ANONYMOUS_SESSION;
      }
      throw toAuthError(error);
    }
  }

  async signIn(
    credentials: SignInCredentials,
  ): Promise<AuthenticatedSession> {
    try {
      const envelope = await this.#getSessionEnvelope("/auth/login", {
        method: "POST",
        body: credentials,
      });
      return toFrontendSession(envelope.session);
    } catch (error: unknown) {
      throw toAuthError(error);
    }
  }

  async startDemoSession(
    audience: AuthAudience,
  ): Promise<AuthenticatedSession> {
    void audience;
    throw new AuthError(
      "AUTH_NOT_CONFIGURED",
      "Los accesos de demostración no están disponibles en modo HTTP.",
    );
  }

  async signOut(): Promise<void> {
    try {
      await this.#client.requestVoid("/auth/logout", {
        method: "POST",
        csrf: true,
      });
      this.#client.clearCsrfToken();
    } catch (error: unknown) {
      if (error instanceof HttpClientError && error.status === 401) {
        this.#client.clearCsrfToken();
        return;
      }
      throw toAuthError(error);
    }
  }

  async #getSessionEnvelope(
    path: string,
    options: Readonly<{ method?: "POST"; body?: unknown }> = {},
  ): Promise<AuthSessionEnvelope> {
    const envelope = await this.#client.request(path, {
      ...options,
      responseSchema: authSessionEnvelopeSchema,
    });
    this.#client.setCsrfToken(envelope.csrfToken);
    return envelope;
  }
}
