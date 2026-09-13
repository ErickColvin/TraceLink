import { z } from "zod";
import { describe, expect, it } from "vitest";

import { AppError } from "../../src/shared/errors/app-error.js";
import { parseWithSchema } from "../../src/shared/validation/parse.js";

describe("parseWithSchema", () => {
  const schema = z.object({ quantity: z.number().int().positive() }).strict();

  it("returns validated data", () => {
    expect(parseWithSchema(schema, { quantity: 2 }, "body")).toEqual({
      quantity: 2,
    });
  });

  it("throws a normalized error without copying the raw payload", () => {
    const payload = { quantity: -1, password: "do-not-copy" };

    try {
      parseWithSchema(schema, payload, "body");
      throw new Error("Expected validation to fail.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect(JSON.stringify(error)).not.toContain(payload.password);
      expect((error as AppError).code).toBe("VALIDATION_ERROR");
    }
  });
});
