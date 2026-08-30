import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ContactPage } from "./contact-page";

describe("ContactPage", () => {
  it("associates validation errors and reports the demo success state", async () => {
    const user = userEvent.setup();
    render(<ContactPage />);

    await user.click(screen.getByRole("button", { name: "Preparar mensaje" }));

    const nameInput = screen.getByLabelText("Nombre");
    expect(await screen.findByText("Ingresa tu nombre.")).toBeInTheDocument();
    expect(nameInput).toHaveAccessibleDescription("Ingresa tu nombre.");

    await user.type(nameInput, "Valentina Rojas");
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "valentina@example.cl",
    );
    await user.type(
      screen.getByLabelText("Mensaje"),
      "Necesito orientación sobre el retiro de mi pedido.",
    );
    await user.click(screen.getByRole("button", { name: "Preparar mensaje" }));

    expect(
      await screen.findByText(/Mensaje preparado correctamente/i),
    ).toBeInTheDocument();
  });
});
