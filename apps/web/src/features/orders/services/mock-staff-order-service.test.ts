import { describe, expect, it } from "vitest";

import { MockStaffOrderService } from "./mock-staff-order-service";

const actor = {
  id: "staff-test",
  name: "Operador de pruebas",
};

const fixedNow = () => new Date("2026-08-30T12:00:00.000Z");

describe("MockStaffOrderService", () => {
  it("aplica una transiciÃ³n vÃ¡lida y registra el evento auditado", async () => {
    const service = new MockStaffOrderService({ latencyMs: 0, now: fixedNow });
    const before = await service.getById("order-2026-0849");

    const result = await service.transitionStatus({
      orderId: before.id,
      toStatus: "PAID",
      actor,
    });

    expect(result.status).toBe("PAID");
    expect(result.paymentStatus).toBe("PAID");
    expect(result.statusEvents).toHaveLength(before.statusEvents.length + 1);
    expect(result.statusEvents.at(-1)).toMatchObject({
      fromStatus: "PENDING_PAYMENT",
      toStatus: "PAID",
      actorId: actor.id,
      actorName: actor.name,
      occurredAt: "2026-08-30T12:00:00.000Z",
    });
  });

  it("rechaza un salto invÃ¡lido sin modificar el pedido", async () => {
    const service = new MockStaffOrderService({ latencyMs: 0, now: fixedNow });
    const before = await service.getById("order-2026-0849");

    await expect(
      service.transitionStatus({
        orderId: before.id,
        toStatus: "PREPARING",
        actor,
      }),
    ).rejects.toMatchObject({ name: "InvalidOrderTransitionError" });

    const after = await service.getById(before.id);
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.statusEvents).toHaveLength(before.statusEvents.length);
  });

  it("exige motivo y audita una cancelaciÃ³n permitida", async () => {
    const service = new MockStaffOrderService({ latencyMs: 0, now: fixedNow });

    await expect(
      service.cancel({
        orderId: "order-2026-0845",
        reason: "   ",
        actor,
      }),
    ).rejects.toMatchObject({ name: "InvalidOrderCancellationError" });

    const result = await service.cancel({
      orderId: "order-2026-0845",
      reason: "  Cliente solicitÃ³ anular el retiro.  ",
      actor,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.cancellationReason).toBe(
      "Cliente solicitÃ³ anular el retiro.",
    );
    expect(result.statusEvents.at(-1)).toMatchObject({
      fromStatus: "PAID",
      toStatus: "CANCELLED",
      actorId: actor.id,
      reason: "Cliente solicitÃ³ anular el retiro.",
    });
  });

  it("no permite cancelar un pedido terminal", async () => {
    const service = new MockStaffOrderService({ latencyMs: 0, now: fixedNow });

    await expect(
      service.cancel({
        orderId: "order-2026-0672",
        reason: "Intento posterior a la entrega.",
        actor,
      }),
    ).rejects.toMatchObject({ name: "InvalidOrderCancellationError" });
  });
});
