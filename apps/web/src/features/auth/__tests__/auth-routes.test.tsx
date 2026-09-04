import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useState, type PropsWithChildren } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthProvider } from "../context/auth-provider";
import type {
  AuthSession,
  SignInCredentials,
  StaffSession,
} from "../model/auth";
import { CustomerRoute } from "../routes/customer-route";
import { StaffRoute } from "../routes/staff-route";
import type { AuthService } from "../services/auth-service";

function createStaticService(session: AuthSession): AuthService {
  return {
    demoSessionsEnabled: false,
    getSession: async () => session,
    signIn: async (credentials: SignInCredentials) => {
      void credentials;
      if (session.kind === "anonymous") {
        throw new Error("No authenticated session configured for this test.");
      }

      return session;
    },
    startDemoSession: async () => {
      if (session.kind === "anonymous") {
        throw new Error("No authenticated session configured for this test.");
      }

      return session;
    },
    signOut: async () => undefined,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}${location.hash}`}</output>;
}

function AuthTestProvider({
  children,
  session,
}: PropsWithChildren<{ session: AuthSession }>) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider service={createStaticService(session)}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

const limitedStaffSession: StaffSession = {
  kind: "staff",
  authSource: "demo",
  authenticatedAt: "2026-08-29T12:00:00.000Z",
  staff: {
    id: "staff-operations",
    firstName: "Camila",
    lastName: "Torres",
    email: "camila.torres@example.cl",
    role: "OPERATIONS",
    roleLabel: "Operaciones",
  },
  permissions: ["orders.view"],
};

describe("authentication route guards", () => {
  it("sends anonymous customers to login and safely preserves their location", async () => {
    render(
      <MemoryRouter
        initialEntries={["/mi-cuenta/pedidos?estado=preparando#recientes"]}
      >
        <AuthTestProvider session={{ kind: "anonymous" }}>
          <Routes>
            <Route
              element={
                <CustomerRoute>
                  <p>Pedidos privados</p>
                </CustomerRoute>
              }
              path="/mi-cuenta/pedidos"
            />
            <Route element={<LocationProbe />} path="/login" />
          </Routes>
        </AuthTestProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/\/login\?returnTo=/u)).toHaveTextContent(
      `/login?returnTo=${encodeURIComponent(
        "/mi-cuenta/pedidos?estado=preparando#recientes",
      )}`,
    );
  });

  it("renders a staff route when the required permission is present", async () => {
    render(
      <MemoryRouter initialEntries={["/app/orders"]}>
        <AuthTestProvider session={limitedStaffSession}>
          <StaffRoute permission="orders.view">
            <p>Órdenes operativas</p>
          </StaffRoute>
        </AuthTestProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Órdenes operativas")).toBeInTheDocument();
  });

  it("shows a useful denial state when a staff permission is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/app/settings"]}>
        <AuthTestProvider session={limitedStaffSession}>
          <StaffRoute permission="settings.manage">
            <p>Configuración privada</p>
          </StaffRoute>
        </AuthTestProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Acceso restringido",
    );
    expect(screen.queryByText("Configuración privada")).not.toBeInTheDocument();
  });
});
