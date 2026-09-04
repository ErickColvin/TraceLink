import { describe, expect, it } from "vitest";

import { HttpAuthService } from "./auth/services/http-auth-service";
import { MockAuthService } from "./auth/services/mock-auth-service";
import {
  composeApplicationServices,
  createMockApplicationServices,
} from "./service-composition";

describe("service composition root", () => {
  it("mantiene el modo mock como default de desarrollo y tests", () => {
    expect(createMockApplicationServices().authService).toBeInstanceOf(
      MockAuthService,
    );
  });

  it("selecciona todos los adapters HTTP con una sola decisión", () => {
    const services = composeApplicationServices({
      dataMode: "http",
      apiBaseUrl: "https://api.test/api/v1",
    });

    expect(services.authService).toBeInstanceOf(HttpAuthService);
    expect(Object.keys(services)).toHaveLength(15);
  });
});
