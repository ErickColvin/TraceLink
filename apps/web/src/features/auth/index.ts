export {
  ANONYMOUS_SESSION,
  PERMISSIONS,
  hasStaffPermission,
  isCustomerSession,
  isStaffSession,
} from "./model/auth";
export type {
  AnonymousSession,
  AuthAudience,
  AuthenticatedSession,
  AuthSession,
  AuthSource,
  CustomerAccount,
  CustomerSession,
  Permission,
  SignInCredentials,
  StaffAccount,
  StaffRole,
  StaffSession,
} from "./model/auth";
export {
  useAuth,
  useHasPermission,
} from "./context/auth-context";
export type {
  AuthContextValue,
  AuthStatus,
} from "./context/auth-context";
export { AuthProvider } from "./context/auth-provider";
export type { AuthProviderProps } from "./context/auth-provider";
export { CustomerRoute } from "./routes/customer-route";
export type { CustomerRouteProps } from "./routes/customer-route";
export { StaffRoute } from "./routes/staff-route";
export type { StaffRouteProps } from "./routes/staff-route";
export {
  CUSTOMER_HOME_PATH,
  LOGIN_PATH,
  STAFF_HOME_PATH,
  createLoginPath,
  resolvePostAuthPath,
  sanitizeInternalPath,
} from "./routing/auth-paths";
export { LoginPage } from "./pages/login-page";
export {
  AuthError,
  normalizeAuthError,
} from "./services/auth-service";
export type {
  AuthErrorCode,
  AuthService,
} from "./services/auth-service";
export { MockAuthService } from "./services/mock-auth-service";
