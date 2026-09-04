import { createContext, useContext } from "react";

import type {
  AuthAudience,
  AuthenticatedSession,
  AuthSession,
  Permission,
  SignInCredentials,
} from "../model/auth";
import type { AuthError } from "../services/auth-service";

export type AuthStatus = "loading" | "ready";

export type AuthContextValue = Readonly<{
  status: AuthStatus;
  session: AuthSession;
  demoSessionsEnabled: boolean;
  isPending: boolean;
  error: AuthError | null;
  signIn(credentials: SignInCredentials): Promise<AuthenticatedSession>;
  startDemoSession(audience: AuthAudience): Promise<AuthenticatedSession>;
  signOut(): Promise<void>;
  clearError(): void;
  hasPermission(permission: Permission): boolean;
}>;

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  }

  return context;
}

export function useHasPermission(permission: Permission): boolean {
  return useAuth().hasPermission(permission);
}
