import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrackingTimeline } from "@/features/packages/components/tracking-timeline";

describe("TrackingTimeline", () => {
  it("muestra eventos completados y pasos futuros con contexto textual", () => {
    render(
      <TrackingTimeline
        currentStatus="STORED"
        events={[
          { id: "1", status: "EXPECTED", occurredAt: "2026-08-27T10:00:00.000Z", description: "Paquete anunciado." },
          { id: "2", status: "RECEIVED", occurredAt: "2026-08-28T10:00:00.000Z", description: "Recepción confirmada." },
          { id: "3", status: "STORED", occurredAt: "2026-08-28T10:20:00.000Z", description: "Ubicación asignada.", location: "Cámara fría" },
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: /historial de trazabilidad/i })).toBeInTheDocument();
    expect(screen.getByText("Paquete recibido")).toBeInTheDocument();
    expect(screen.getByText("Listo para retiro")).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);
    expect(screen.getByText("Cámara fría")).toBeInTheDocument();
  });

  it("conserva estados repetidos y muestra una incidencia antes de los pasos futuros", () => {
    render(
      <TrackingTimeline
        currentStatus="INCIDENT"
        events={[
          { id: "expected", status: "EXPECTED", occurredAt: "2026-08-27T10:00:00.000Z", description: "Paquete anunciado." },
          { id: "received-1", status: "RECEIVED", occurredAt: "2026-08-28T10:00:00.000Z", description: "Primera recepción." },
          { id: "received-2", status: "RECEIVED", occurredAt: "2026-08-28T10:05:00.000Z", description: "Recepción verificada nuevamente." },
          { id: "incident", status: "INCIDENT", occurredAt: "2026-08-28T10:10:00.000Z", description: "Paquete retenido para revisión." },
        ]}
      />,
    );

    expect(screen.getAllByText("Paquete recibido")).toHaveLength(2);

    const itemLabels = screen
      .getAllByRole("listitem")
      .map((item) => item.querySelector("h3")?.textContent);

    expect(itemLabels).toEqual([
      "Paquete esperado",
      "Paquete recibido",
      "Paquete recibido",
      "Incidencia",
      "Almacenado",
      "Listo para retiro",
      "Retirado",
    ]);
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(
      "Paquete retenido para revisión.",
    );
  });
});
