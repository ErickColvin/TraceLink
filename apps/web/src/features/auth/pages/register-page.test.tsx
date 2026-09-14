import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type PropsWithChildren } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../context/auth-provider";
import {
  ANONYMOUS_SESSION,
  type CustomerSession,
  type RegisterCredentials,
} from "../model/auth";
import { AuthError, type AuthService } from "../services/auth-service";
import { RegisterPage } from "./register-page";

const registeredSession: CustomerSession = {
  kind: "customer",
  authSource: "remote",
  authenticatedAt: "2026-09-06T12:00:00.000Z",
  customer: {
    id: "user-new-customer",
    customerId: "customer-new",
    firstName: "Valentina",
    lastName: "Rojas",
    email: "valentina@example.cl",
  },
};

function TestProviders({
  children,
  service,
}: PropsWithChildren<{ service: AuthService }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider service={service}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function createService(
  registerAccount: (credentials: RegisterCredentials) => Promise<CustomerSession>,
): AuthService {
  return {
    demoSessionsEnabled: false,
    getSession: async () => ANONYMOUS_SESSION,
    register: registerAccount,
    signIn: async () => {
      throw new Error("Not used by this test.");
    },
    signOut: async () => undefined,
    startDemoSession: async () => {
      throw new Error("Not used by this test.");
    },
  };
}

async function completeForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "Valentina");
  await user.type(screen.getByLabelText("Apellido"), "Rojas");
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "valentina@example.cl",
  );
  await user.type(screen.getByLabelText("Teléfono (opcional)"), "+56912345678");
  await user.type(screen.getByLabelText("Contraseña"), "una-clave-segura-123");
  await user.type(
    screen.getByLabelText("Confirmar contraseña"),
    "una-clave-segura-123",
  );
}

describe("RegisterPage", () => {
  it("envía el formulario accesible y conserva un returnTo interno", async () => {
    const user = userEvent.setup();
    const registerAccount = vi.fn(async () => registeredSession);

    render(
      <MemoryRouter initialEntries={["/registro?returnTo=%2Fmi-cuenta%2Fpedidos"]}>
        <TestProviders service={createService(registerAccount)}>
          <Routes>
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/mi-cuenta/pedidos" element={<p>Pedidos privados</p>} />
          </Routes>
        </TestProviders>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Crea tu cuenta" }),
    ).toBeInTheDocument();
    await completeForm(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Pedidos privados")).toBeInTheDocument();
    expect(registerAccount).toHaveBeenCalledWith({
      firstName: "Valentina",
      lastName: "Rojas",
      email: "valentina@example.cl",
      password: "una-clave-segura-123",
      phone: "+56912345678",
    });
  });

  it("muestra validación local antes de llamar al servicio", async () => {
    const user = userEvent.setup();
    const registerAccount = vi.fn(async () => registeredSession);

    render(
      <MemoryRouter initialEntries={["/registro"]}>
        <TestProviders service={createService(registerAccount)}>
          <Routes>
            <Route path="/registro" element={<RegisterPage />} />
          </Routes>
        </TestProviders>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Crea tu cuenta" });
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText(/nombre de al menos 2/u)).toBeInTheDocument();
    expect(screen.getByText("Confirma tu contraseña.")).toBeInTheDocument();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("mantiene el formulario y anuncia un error de API", async () => {
    const user = userEvent.setup();
    const registerAccount = vi.fn(async () => {
      throw new AuthError(
        "UNKNOWN",
        "No fue posible registrar una cuenta con esos datos.",
      );
    });

    render(
      <MemoryRouter initialEntries={["/registro"]}>
        <TestProviders service={createService(registerAccount)}>
          <Routes>
            <Route path="/registro" element={<RegisterPage />} />
          </Routes>
        </TestProviders>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Crea tu cuenta" });
    await completeForm(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No fue posible crear la cuenta");
    expect(alert).toHaveTextContent(
      "No fue posible registrar una cuenta con esos datos.",
    );
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "valentina@example.cl",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("");
  });
});
