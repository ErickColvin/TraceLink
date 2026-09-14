import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { ConfirmationDialog } from "./confirmation-dialog";

function DialogHarness({ onConfirm = () => undefined }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir confirmación</Button>
      <ConfirmationDialog
        open={open}
        title="Confirmar acción"
        description="Esta acción cambia el registro."
        onConfirm={onConfirm}
        onOpenChange={setOpen}
      />
    </>
  );
}

describe("ConfirmationDialog", () => {
  it("mueve el foco, cierra con Escape y lo devuelve al activador", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir confirmación" });

    await user.click(trigger);
    expect(screen.getByRole("alertdialog", { name: "Confirmar acción" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Volver" })).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("ejecuta la confirmación explícita", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DialogHarness onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Abrir confirmación" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
