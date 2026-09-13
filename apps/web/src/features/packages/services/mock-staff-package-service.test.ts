import { describe, expect, it } from "vitest";

import { MockStaffPackageService } from "./mock-staff-package-service";

const actor = { id: "staff-test", name: "Operador de pruebas" };
const fixedNow = () => new Date("2026-08-30T14:00:00.000Z");

describe("MockStaffPackageService", () => {
  it("combina filtros operativos por tracking, cliente, carrier y ubicación", async () => {
    const service = new MockStaffPackageService({ latencyMs: 0 });

    const result = await service.list({
      tracking: "41028",
      customer: "Valentina",
      carrier: "Blue Express",
      location: "F-03",
    });

    expect(result.items.map((item) => item.id)).toEqual([
      "package-ch-41028",
    ]);
  });

  it("aplica una transición estándar y crea un TrackingEvent", async () => {
    const service = new MockStaffPackageService({ latencyMs: 0, now: fixedNow });
    const before = await service.getById("package-ch-41052");

    const result = await service.transitionStatus({
      packageId: before.id,
      toStatus: "RECEIVED",
      actor,
    });

    expect(result.status).toBe("RECEIVED");
    expect(result.receivedAt).toBe("2026-08-30T14:00:00.000Z");
    expect(result.events).toHaveLength(before.events.length + 1);
    expect(result.events.at(-1)).toMatchObject({
      status: "RECEIVED",
      recordedBy: actor.name,
      occurredAt: "2026-08-30T14:00:00.000Z",
    });
  });

  it("rechaza saltos de estado sin modificar el paquete", async () => {
    const service = new MockStaffPackageService({ latencyMs: 0, now: fixedNow });
    const before = await service.getById("package-ch-41052");

    await expect(
      service.transitionStatus({
        packageId: before.id,
        toStatus: "STORED",
        location: "Bodega seca · A-01",
        actor,
      }),
    ).rejects.toMatchObject({ name: "InvalidPackageTransitionError" });

    const after = await service.getById(before.id);
    expect(after.status).toBe(before.status);
    expect(after.events).toHaveLength(before.events.length);
  });

  it("exige una descripción para excepciones y registra el evento", async () => {
    const service = new MockStaffPackageService({ latencyMs: 0, now: fixedNow });

    await expect(
      service.transitionStatus({
        packageId: "package-ch-40991",
        toStatus: "INCIDENT",
        actor,
      }),
    ).rejects.toMatchObject({ name: "InvalidPackageTransitionError" });

    const result = await service.transitionStatus({
      packageId: "package-ch-40991",
      toStatus: "INCIDENT",
      description: "Temperatura fuera del rango durante la revisión.",
      location: "Zona de inspección",
      actor,
    });

    expect(result.status).toBe("INCIDENT");
    expect(result.events.at(-1)).toMatchObject({
      status: "INCIDENT",
      description: "Temperatura fuera del rango durante la revisión.",
      location: "Zona de inspección",
      recordedBy: actor.name,
    });
  });

  it("exige código y receptor para entregar, sin conservar el código", async () => {
    const service = new MockStaffPackageService({ latencyMs: 0, now: fixedNow });

    await expect(
      service.deliver({
        packageId: "package-ch-41028",
        pickupCode: "",
        receivedBy: "Valentina Rojas",
        actor,
      }),
    ).rejects.toMatchObject({ name: "InvalidPackageDeliveryError" });

    const result = await service.deliver({
      packageId: "package-ch-41028",
      pickupCode: "4821",
      receivedBy: "Valentina Rojas",
      actor,
    });

    expect(result.status).toBe("PICKED_UP");
    expect(result.pickupReceipt).toEqual({
      receivedBy: "Valentina Rojas",
      pickupCodeVerified: true,
      deliveredAt: "2026-08-30T14:00:00.000Z",
      deliveredBy: actor.name,
    });
    expect(result.events.at(-1)).toMatchObject({ status: "PICKED_UP" });
    expect(JSON.stringify(result)).not.toContain("4821");
  });

  it("recibe un paquete solo para un cliente registrado", async () => {
    const service = new MockStaffPackageService({ latencyMs: 0, now: fixedNow });

    await expect(
      service.receive({
        trackingCode: "CHM-50001-CL",
        carrier: "Blue Express",
        customerId: "customer-inexistente",
        contents: {
          description: "Productos congelados",
          itemCount: 2,
          requiresColdStorage: true,
        },
        storageLocation: "Cámara fría · C-01",
        actor,
      }),
    ).rejects.toMatchObject({ name: "StaffPackageCustomerNotFoundError" });

    const result = await service.receive({
      trackingCode: "chm-50001-cl",
      carrier: "Blue Express",
      customerId: "customer-isidora-perez",
      contents: {
        description: "Productos congelados",
        itemCount: 2,
        requiresColdStorage: true,
      },
      storageLocation: "Cámara fría · C-01",
      receivedAt: "2026-08-30T13:55:00.000Z",
      actor,
    });

    expect(result.trackingCode).toBe("CHM-50001-CL");
    expect(result.customer.id).toBe("customer-isidora-perez");
    expect(result.status).toBe("RECEIVED");
    expect(result.events.map((event) => event.status)).toEqual([
      "EXPECTED",
      "RECEIVED",
    ]);
  });
});
