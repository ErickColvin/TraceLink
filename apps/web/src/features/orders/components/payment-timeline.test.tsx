import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaymentTimeline } from "./payment-timeline";

const timestamp = "2026-09-11T12:00:00.000Z";

describe("PaymentTimeline", () => {
  it("renders persisted attempts and the authoritative payment status", () => {
    render(
      <PaymentTimeline
        details={{
          payment: {
            id: "payment-1",
            orderId: "order-1",
            provider: "MERCADOPAGO",
            status: "APPROVED",
            amount: 12_000,
            currency: "CLP",
            providerExternalReference: "external-1",
            approvedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          attempts: [{
            id: "attempt-1",
            paymentId: "payment-1",
            attemptNumber: 1,
            status: "PENDING",
            startedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          }],
        }}
      />,
    );

    expect(screen.getByText("Checkout creado")).toBeInTheDocument();
    expect(screen.getByText("Intento 1: Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Pago aprobado")).toBeInTheDocument();
  });

  it("renders an explicit empty state for legacy orders", () => {
    render(<PaymentTimeline />);
    expect(screen.getByText(/no tiene eventos de pago/i)).toBeInTheDocument();
  });
});
