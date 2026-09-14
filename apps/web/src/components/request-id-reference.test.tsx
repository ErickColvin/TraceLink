import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RequestIdReference } from "./request-id-reference";

describe("RequestIdReference", () => {
  it("shows and copies the operational request ID", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<RequestIdReference requestId="req-operational-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar ID de solicitud" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("req-operational-123"));
    expect(screen.getByText("Copiado")).toBeInTheDocument();
  });

  it("renders nothing without a request ID", () => {
    const { container } = render(<RequestIdReference />);
    expect(container).toBeEmptyDOMElement();
  });
});
