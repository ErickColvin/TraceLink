import { describe, expect, it } from "vitest";

import {
  normalizeApiBaseUrl,
  parseDataMode,
  readRuntimeConfig,
} from "./runtime";

describe("runtime config", () => {
  it("usa mocks por defecto y normaliza la URL de API", () => {
    expect(readRuntimeConfig({ VITE_API_BASE_URL: "https://api.test/v1///" })).toEqual({
      apiBaseUrl: "https://api.test/v1",
      dataMode: "mock",
    });
    expect(normalizeApiBaseUrl(undefined)).toBe("/api/v1");
    expect(normalizeApiBaseUrl("api/v1/")).toBe("/api/v1");
  });

  it("habilita http explícitamente y rechaza modos desconocidos", () => {
    expect(parseDataMode("http")).toBe("http");
    expect(() => parseDataMode("automatic")).toThrow(/mock.*http/u);
  });
});
