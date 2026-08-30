import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Alert,
  BrandLogo,
  Button,
  ErrorState,
  Input,
  Label,
  LoadingSkeleton,
  Spinner,
  buttonStyles,
} from ".";

describe("presentational primitives", () => {
  it("keeps buttons safe inside forms by default", () => {
    render(<Button>Ver productos</Button>);

    expect(screen.getByRole("button", { name: "Ver productos" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(buttonStyles({ variant: "outline" })).toContain("border-ink-200");
  });

  it("associates labels and inputs through native attributes", () => {
    render(
      <div>
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" type="email" />
      </div>,
    );

    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "type",
      "email",
    );
  });

  it("keeps the tenant name available when the logo is compact", () => {
    render(
      <BrandLogo compact name="CH Market" shortName="CH" size="sm" />,
    );

    expect(screen.getByText("CH Market")).toHaveClass("sr-only");
  });

  it("announces loading and error states with useful labels", () => {
    render(
      <>
        <Spinner label="Cargando pedidos" />
        <LoadingSkeleton label="Cargando catálogo" className="h-10" />
        <ErrorState title="No fue posible cargar los productos" />
      </>,
    );

    expect(screen.getByText("Cargando pedidos").parentElement).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByText("Cargando catálogo").parentElement).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByRole("alert")).toHaveAccessibleName(
      "No fue posible cargar los productos",
    );
  });

  it("uses an assertive role only for danger alerts by default", () => {
    const { rerender } = render(<Alert tone="info">Información</Alert>);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<Alert tone="danger">Ocurrió un error</Alert>);

    expect(screen.getByRole("alert")).toHaveTextContent("Ocurrió un error");
  });
});
