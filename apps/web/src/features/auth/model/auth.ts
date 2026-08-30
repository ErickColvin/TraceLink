export const PERMISSIONS = Object.freeze([
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "inventory.view",
  "inventory.adjust",
  "orders.view",
  "orders.update",
  "orders.cancel",
  "packages.view",
  "packages.receive",
  "packages.update",
  "packages.deliver",
  "customers.view",
  "customers.update",
  "users.view",
  "users.manage",
  "reports.view",
  "settings.manage",
] as const);

export type Permission = (typeof PERMISSIONS)[number];

export type AuthAudience = "customer" | "staff";
export type AuthSource = "demo" | "remote";

export type CustomerAccount = Readonly<{
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
}>;

export type StaffRole = "administrator" | "operations" | "inventory";

export type StaffAccount = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: StaffRole;
  roleLabel: string;
}>;

export type AnonymousSession = Readonly<{
  kind: "anonymous";
}>;

export type CustomerSession = Readonly<{
  kind: "customer";
  authSource: AuthSource;
  authenticatedAt: string;
  customer: CustomerAccount;
}>;

export type StaffSession = Readonly<{
  kind: "staff";
  authSource: AuthSource;
  authenticatedAt: string;
  staff: StaffAccount;
  permissions: readonly Permission[];
}>;

export type AuthenticatedSession = CustomerSession | StaffSession;
export type AuthSession = AnonymousSession | AuthenticatedSession;

export const ANONYMOUS_SESSION: AnonymousSession = Object.freeze({
  kind: "anonymous",
});

export type SignInCredentials = Readonly<{
  audience: AuthAudience;
  email: string;
  password: string;
}>;

export function isCustomerSession(
  session: AuthSession,
): session is CustomerSession {
  return session.kind === "customer";
}

export function isStaffSession(session: AuthSession): session is StaffSession {
  return session.kind === "staff";
}

export function hasStaffPermission(
  session: AuthSession,
  permission: Permission,
): boolean {
  return isStaffSession(session) && session.permissions.includes(permission);
}
