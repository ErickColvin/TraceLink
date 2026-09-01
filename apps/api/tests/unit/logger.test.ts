import { describe, expect, it } from "vitest";

import { redactSensitiveText } from "../../src/shared/logging/logger.js";

describe("redactSensitiveText", () => {
  it("redacts URL credentials, bearer tokens and sensitive assignments", () => {
    const result = redactSensitiveText(
      "postgresql://admin:secret@db.local/app authorization=Bearer-value Bearer abc123 password=hunter2",
    );

    expect(result).not.toContain("admin:secret");
    expect(result).not.toContain("abc123");
    expect(result).not.toContain("hunter2");
    expect(result).toContain("[REDACTED]");
  });
});
