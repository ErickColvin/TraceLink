import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  ANONYMOUS_SESSION,
  hasStaffPermission,
  type AuthAudience,
  type AuthenticatedSession,
  type AuthSession,
  type Permission,
  type SignInCredentials,
} from "../model/auth";
import {
  normalizeAuthError,
  type AuthError,
  type AuthService,
} from "../services/auth-service";
import { applicationServices } from "../../service-composition";
import { clearCustomerPrivateQueries } from "../query-scope";
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from "./auth-context";

export type AuthProviderProps = Readonly<{
  children: ReactNode;
  service?: AuthService;
}>;

export function AuthProvider({ children, service }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [authService] = useState<AuthService>(
    () => service ?? applicationServices.authService,
  );
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession>(ANONYMOUS_SESSION);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const clearPrivateCache = useCallback(
    () => clearCustomerPrivateQueries(queryClient),
    [queryClient],
  );

  useEffect(() => {
    let isActive = true;

    const restoreSession = async () => {
      try {
        await clearPrivateCache();
        if (!isActive) return;
        const restoredSession = await authService.getSession();
        if (isActive) {
          setSession(restoredSession);
        }
      } catch (restoreError: unknown) {
        if (isActive) {
          setSession(ANONYMOUS_SESSION);
          setError(normalizeAuthError(restoreError));
        }
      } finally {
        if (isActive) {
          setStatus("ready");
        }
      }
    };

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, [authService, clearPrivateCache]);

  const runSessionOperation = useCallback(
    async (
      operation: () => Promise<AuthenticatedSession>,
    ): Promise<AuthenticatedSession> => {
      setIsPending(true);
      setError(null);

      try {
        await clearPrivateCache();
        const nextSession = await operation();
        await clearPrivateCache();
        setSession(nextSession);
        return nextSession;
      } catch (operationError: unknown) {
        await clearPrivateCache();
        const normalizedError = normalizeAuthError(operationError);
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsPending(false);
      }
    },
    [clearPrivateCache],
  );

  const signIn = useCallback(
    (credentials: SignInCredentials) =>
      runSessionOperation(() => authService.signIn(credentials)),
    [authService, runSessionOperation],
  );

  const startDemoSession = useCallback(
    (audience: AuthAudience) =>
      runSessionOperation(() => authService.startDemoSession(audience)),
    [authService, runSessionOperation],
  );

  const signOut = useCallback(async () => {
    setIsPending(true);
    setError(null);

    try {
      await clearPrivateCache();
      await authService.signOut();
      await clearPrivateCache();
      setSession(ANONYMOUS_SESSION);
    } catch (signOutError: unknown) {
      await clearPrivateCache();
      const normalizedError = normalizeAuthError(signOutError);
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setIsPending(false);
    }
  }, [authService, clearPrivateCache]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => hasStaffPermission(session, permission),
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      demoSessionsEnabled: authService.demoSessionsEnabled,
      isPending,
      error,
      signIn,
      startDemoSession,
      signOut,
      clearError,
      hasPermission,
    }),
    [
      status,
      session,
      authService,
      isPending,
      error,
      signIn,
      startDemoSession,
      signOut,
      clearError,
      hasPermission,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
