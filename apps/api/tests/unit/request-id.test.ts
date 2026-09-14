import { describe, expect, it } from "vitest";

import { resolveRequestId } from "../../src/middleware/request-id.js";

describe("resolveRequestId", () => {
  it("preserves a bounded safe request id", () => {
    expect(resolveRequestId("upstream:request-123")).toBe(
      "upstream:request-123",
    );
  });

  it("replaces unsafe or oversized values", () => {
    expect(resolveRequestId("contains spaces")).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(resolveRequestId("x".repeat(65))).toMatch(/^[0-9a-f-]{36}$/);
  });
});
