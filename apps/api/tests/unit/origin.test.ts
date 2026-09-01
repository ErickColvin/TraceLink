import { describe, expect, it } from "vitest";

import { isAllowedOrigin } from "../../src/shared/security/origin.js";

describe("isAllowedOrigin", () => {
  const allowed = "http://127.0.0.1:5173";

  it("allows only the exact configured origin", () => {
    expect(isAllowedOrigin(allowed, allowed)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", allowed)).toBe(false);
    expect(isAllowedOrigin(`${allowed}/`, allowed)).toBe(false);
    expect(isAllowedOrigin(undefined, allowed)).toBe(false);
  });
});
