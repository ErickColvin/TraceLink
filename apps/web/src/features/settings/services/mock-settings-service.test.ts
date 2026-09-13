import { describe, expect, it } from "vitest";

import { MockSettingsService } from "./mock-settings-service";

describe("MockSettingsService", () => {
  it("devuelve copias y conserva una actualización tipada", async () => {
    const service = new MockSettingsService();
    const initial = await service.get();
    const updated = await service.update({
      ...initial,
      contactPhone: "+56 2 2000 3000",
    });

    expect(updated.contactPhone).toBe("+56 2 2000 3000");
    expect(updated.updatedAt).not.toBe(initial.updatedAt);
    expect(await service.get()).not.toBe(updated);
  });
});
