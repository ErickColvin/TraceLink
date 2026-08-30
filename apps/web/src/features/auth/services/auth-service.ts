import type {
  AuthAudience,
  AuthenticatedSession,
  AuthSession,
  SignInCredentials,
} from "../model/auth";

export type AuthErrorCode =
  | "AUTH_NOT_CONFIGURED"
  | "INVALID_CREDENTIALS"
  | "SESSION_UNAVAILABLE"
  | "UNKNOWN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/**
 * Authentication boundary for the UI. A future HTTP implementation should
 * exchange credentials with the backend and rely on its server-side session.
 */
export interface AuthService {
  getSession(): Promise<AuthSession>;
  signIn(credentials: SignInCredentials): Promise<AuthenticatedSession>;
  startDemoSession(audience: AuthAudience): Promise<AuthenticatedSession>;
  signOut(): Promise<void>;
}

export function normalizeAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  return new AuthError(
    "UNKNOWN",
    "No pudimos completar la operación. Intenta nuevamente.",
  );
}
