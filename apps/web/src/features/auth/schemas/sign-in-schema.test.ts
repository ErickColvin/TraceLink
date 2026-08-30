import { describe, expect, it } from "vitest";
import { signInSchema } from "@/features/auth/schemas/sign-in-schema";

describe("signInSchema", () => {
  it("rechaza correos inválidos y contraseñas demasiado cortas", () => {
    const result = signInSchema.safeParse({
      audience: "customer",
      email: "correo-invalido",
      password: "123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
      expect(result.error.flatten().fieldErrors.password).toBeDefined();
    }
  });

  it("acepta un payload bien formado sin autenticarlo localmente", () => {
    expect(
      signInSchema.safeParse({
        audience: "staff",
        email: "persona@empresa.cl",
        password: "una-clave-de-formato-valido",
      }).success,
    ).toBe(true);
  });
});

