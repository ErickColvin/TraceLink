import type {
  AuthAudience,
  AuthenticatedSession,
  AuthSession,
  RegisterCredentials,
  SignInCredentials,
} from "../model/auth";

export type AuthErrorCode =
  | "AUTH_NOT_CONFIGURED"
  | "ACCOUNT_DISABLED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "SESSION_EXPIRED"
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
  readonly demoSessionsEnabled: boolean;
  getSession(): Promise<AuthSession>;
  register(credentials: RegisterCredentials): Promise<AuthenticatedSession>;
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
