import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { InventoryItem } from "../domain";
import { InventoryMovementForm } from "./inventory-movement-form";

const inventoryItem: InventoryItem = {
  id: "inventory-test",
  productId: "product-test",
  sku: "SKU-TEST",
  productName: "Producto de prueba",
  categoryId: "category-test",
  categoryName: "Pruebas",
  physicalStock: 20,
  reservedStock: 4,
  availableStock: 16,
  minimumStock: 5,
  location: "Bodega principal · A-01",
  batch: "LOT-001",
  expiresAt: "2099-12-31T23:59:59.000Z",
  status: "OK",
  updatedAt: "2026-08-30T10:00:00.000Z",
};

describe("InventoryMovementForm", () => {
  it("requires a reason before preparing an adjustment", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <InventoryMovementForm
        inventoryItems={[inventoryItem]}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Tipo de movimiento"),
      "ADJUSTMENT",
    );
    await user.click(screen.getByRole("button", { name: "Revisar movimiento" }));

    expect(
      await screen.findByText("El motivo es obligatorio para este movimiento."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Motivo/), "Conteo físico mensual");
    await user.click(screen.getByRole("button", { name: "Revisar movimiento" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADJUSTMENT",
        reason: "Conteo físico mensual",
      }),
      expect.anything(),
    );
  });

  it("asks for a destination on outbound transfers", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <InventoryMovementForm
        inventoryItems={[inventoryItem]}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Tipo de movimiento"),
      "TRANSFER_OUT",
    );
    await user.click(screen.getByRole("button", { name: "Revisar movimiento" }));

    expect(
      await screen.findByText("Indica la ubicación de destino de la transferencia."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
