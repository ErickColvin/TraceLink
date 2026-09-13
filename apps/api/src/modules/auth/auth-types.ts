import type {
  AuthAudience,
  AuthSessionEnvelope,
  Permission,
  RegisterRequest,
  RoleCode,
  SignInRequest,
} from "@tracelink/contracts";

export type AuthenticatedOrganization = Readonly<{
  id: string;
  slug: string;
  name: string;
}>;

export type AuthenticatedUser = Readonly<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}>;

type AuthContextBase = Readonly<{
  sessionId: string;
  sessionTokenHash: Buffer;
  user: AuthenticatedUser;
  organization: AuthenticatedOrganization;
  authenticatedAt: string;
  expiresAt: Date;
  lastSeenAt: Date;
}>;

export type CustomerAuthContext = AuthContextBase &
  Readonly<{
    audience: "customer";
    customerId: string;
    permissions: readonly [];
  }>;

export type StaffAuthContext = AuthContextBase &
  Readonly<{
    audience: "staff";
    membershipId: string;
    membershipStatus: "ACTIVE" | "DISABLED";
    role: Readonly<{
      id: string;
      code: RoleCode;
      label: string;
    }>;
    permissions: readonly Permission[];
  }>;

export type AuthContext = CustomerAuthContext | StaffAuthContext;

export type LoginIdentity = Readonly<{
  user: AuthenticatedUser & Readonly<{ passwordHash: string; status: "ACTIVE" | "INACTIVE" }>;
  organization: AuthenticatedOrganization & Readonly<{ active: boolean }>;
  customer?: Readonly<{ id: string; status: "ACTIVE" | "INACTIVE" }>;
  membership?: Readonly<{
    id: string;
    status: "ACTIVE" | "INACTIVE";
    role: Readonly<{ id: string; code: RoleCode; label: string }>;
    permissions: readonly Permission[];
  }>;
}>;

export type CreatedSession = Readonly<{
  id: string;
  createdAt: Date;
  expiresAt: Date;
}>;

export type CreateSessionInput = Readonly<{
  organizationId: string;
  userId: string;
  audience: AuthAudience;
  membershipId?: string;
  customerId?: string;
  tokenHash: Buffer;
  expiresAt: Date;
}>;

export type AuthResult = Readonly<{
  envelope: AuthSessionEnvelope;
  sessionToken: string;
}>;

export type AuthRepositoryPort = Readonly<{
  findLoginIdentity(
    organizationSlug: string,
    emailNormalized: string,
    audience: AuthAudience,
  ): Promise<LoginIdentity | null>;
  createSession(input: CreateSessionInput): Promise<CreatedSession>;
  resolveSession(tokenHash: Buffer): Promise<AuthContext | null>;
  touchSession(sessionId: string): Promise<void>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  registerCustomer(input: Readonly<{
    organizationSlug: string;
    registration: RegisterRequest;
    passwordHash: string;
    tokenHash: Buffer;
    expiresAt: Date;
  }>): Promise<Readonly<{
    identity: LoginIdentity;
    session: CreatedSession;
  }>>;
}>;

export type AuthServicePort = Readonly<{
  signIn(input: SignInRequest): Promise<AuthResult>;
  register(input: RegisterRequest): Promise<AuthResult>;
  getSession(context: AuthContext): AuthSessionEnvelope;
  signOut(context: AuthContext): Promise<void>;
}>;

