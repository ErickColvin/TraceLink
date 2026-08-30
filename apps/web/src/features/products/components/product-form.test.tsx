import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_PRODUCT_FORM_VALUES } from "../schemas/product-form-schema";
import { ProductForm } from "./product-form";

const categories = [
  {
    id: "category-frozen",
    slug: "congelados",
    name: "Congelados",
    description: "Productos congelados.",
  },
] as const;

describe("ProductForm", () => {
  it("associates validation errors and never offers direct stock editing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <ProductForm
        categories={categories}
        defaultValues={EMPTY_PRODUCT_FORM_VALUES}
        pending={false}
        submitLabel="Crear producto"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByLabelText(/stock disponible/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear producto" }));

    const skuInput = screen.getByLabelText("SKU");
    expect(
      await screen.findByText("Ingresa un SKU de al menos 3 caracteres."),
    ).toBeInTheDocument();
    expect(skuInput).toHaveAccessibleDescription(
      "Ingresa un SKU de al menos 3 caracteres.",
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(skuInput, "CON-NUE-100");
    await user.type(screen.getByLabelText("Nombre"), "Nuevo producto");
    await user.type(screen.getByLabelText("Slug"), "nuevo-producto");
    await user.selectOptions(screen.getByLabelText("CategorÃ­a"), "category-frozen");
    await user.clear(screen.getByLabelText("Precio de venta (CLP)"));
    await user.type(screen.getByLabelText("Precio de venta (CLP)"), "4990");
    await user.click(screen.getByRole("button", { name: "Crear producto" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        sku: "CON-NUE-100",
        salePrice: 4990,
        minimumStock: 0,
      }),
    );
  });
});
