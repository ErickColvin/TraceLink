import { describe, expect, it } from "vitest";

import {
  customerFormSchema,
  toCustomerProfileInput,
} from "./customer-form-schema";

const validValues = {
  firstName: "Valentina",
  lastName: "Rojas",
  email: "valentina@example.cl",
  phone: "+56 9 6123 4587",
  addressLine1: "",
  addressLine2: "",
  commune: "",
  city: "",
  region: "",
  status: "ACTIVE",
} as const;

describe("customerFormSchema", () => {
  it("rejects invalid contact data", () => {
    const result = customerFormSchema.safeParse({
      ...validValues,
      email: "correo-invalido",
      phone: "123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["email", "phone"]),
      );
    }
  });

  it("requires a complete address when any address field is present", () => {
    const result = customerFormSchema.safeParse({
      ...validValues,
      addressLine1: "Av. Siempre Viva 123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["commune", "city", "region"]),
      );
    }
  });

  it("maps a valid form to the service input without an empty address", () => {
    const result = customerFormSchema.parse(validValues);

    expect(toCustomerProfileInput(result)).toEqual({
      firstName: "Valentina",
      lastName: "Rojas",
      email: "valentina@example.cl",
      phone: "+56 9 6123 4587",
      address: undefined,
    });
  });
});
