import { describe, expect, it } from "vitest";

import { registerSchema } from "./register-schema";

const validValues = {
  firstName: "Valentina",
  lastName: "Rojas",
  email: "valentina@example.cl",
  phone: "+56912345678",
  password: "una-clave-segura-123",
  confirmPassword: "una-clave-segura-123",
};

describe("registerSchema", () => {
  it("acepta los datos válidos y permite omitir el teléfono", () => {
    expect(registerSchema.safeParse(validValues).success).toBe(true);
    expect(registerSchema.safeParse({ ...validValues, phone: "" }).success).toBe(
      true,
    );
  });

  it("rechaza contraseñas cortas o que no coinciden", () => {
    const result = registerSchema.safeParse({
      ...validValues,
      password: "muy-corta",
      confirmPassword: "otra-clave-segura-123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toBeDefined();
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it("recorta identidad y contacto sin modificar la contraseña", () => {
    const result = registerSchema.parse({
      ...validValues,
      firstName: "  Valentina  ",
      email: "  valentina@example.cl  ",
      phone: "  +56912345678  ",
    });

    expect(result).toMatchObject({
      firstName: "Valentina",
      email: "valentina@example.cl",
      phone: "+56912345678",
      password: validValues.password,
    });
  });
});
