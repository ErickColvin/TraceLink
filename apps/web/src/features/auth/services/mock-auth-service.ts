import {
  ANONYMOUS_SESSION,
  PERMISSIONS,
  type AuthAudience,
  type AuthenticatedSession,
  type AuthSession,
  type CustomerSession,
  type SignInCredentials,
  type StaffSession,
} from "../model/auth";
import {
  DEMO_CUSTOMER_ID,
  mockSessionContext,
  type MockSessionContext,
} from "../../mock-context";
import { AuthError, type AuthService } from "./auth-service";

/**
 * Frontend-only demo adapter.
 *
 * It deliberately does not authenticate passwords, issue tokens, use browser
 * storage, or persist across page reloads. Replace it with an HTTP adapter when
 * the authoritative authentication backend is available.
 */
export class MockAuthService implements AuthService {
  readonly demoSessionsEnabled = true;
  private currentSession: AuthSession = ANONYMOUS_SESSION;
  private readonly now: () => Date;
  private readonly sessionContext: MockSessionContext;

  constructor(
    now: () => Date = () => new Date(),
    sessionContext: MockSessionContext = mockSessionContext,
  ) {
    this.now = now;
    this.sessionContext = sessionContext;
    this.sessionContext.clear();
  }

  async getSession(): Promise<AuthSession> {
    return this.currentSession;
  }

  async signIn(credentials: SignInCredentials): Promise<AuthenticatedSession> {
    // Credentials are intentionally neither inspected nor retained by the demo.
    void credentials;

    throw new AuthError(
      "AUTH_NOT_CONFIGURED",
      "El inicio de sesión real aún no está conectado. Usa un acceso de demostración para explorar la plataforma.",
    );
  }

  async startDemoSession(
    audience: AuthAudience,
  ): Promise<AuthenticatedSession> {
    const session =
      audience === "customer"
        ? this.createCustomerSession()
        : this.createStaffSession();

    if (session.kind === "customer") {
      this.sessionContext.setCurrentCustomer(session.customer.customerId);
    } else {
      this.sessionContext.clear();
    }
    this.currentSession = session;
    return session;
  }

  async signOut(): Promise<void> {
    this.sessionContext.clear();
    this.currentSession = ANONYMOUS_SESSION;
  }

  private createCustomerSession(): CustomerSession {
    return {
      kind: "customer",
      authSource: "demo",
      authenticatedAt: this.now().toISOString(),
      customer: {
        id: "account-valentina-rojas",
        customerId: DEMO_CUSTOMER_ID,
        firstName: "Valentina",
        lastName: "Rojas",
        email: "valentina.rojas@example.cl",
      },
    };
  }

  private createStaffSession(): StaffSession {
    return {
      kind: "staff",
      authSource: "demo",
      authenticatedAt: this.now().toISOString(),
      staff: {
        id: "staff-camila-torres",
        firstName: "Camila",
        lastName: "Torres",
        email: "camila.torres@example.cl",
        role: "ADMIN",
        roleLabel: "Administración",
      },
      permissions: PERMISSIONS,
    };
  }
}
