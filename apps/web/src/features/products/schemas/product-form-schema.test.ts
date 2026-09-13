import { describe, expect, it } from "vitest";

import {
  productFormSchema,
  toProductCommercialInput,
} from "./product-form-schema";

const validValues = {
  sku: "CON-NUE-100",
  barcode: "7801234567890",
  name: "Nuevo producto congelado",
  slug: "nuevo-producto-congelado",
  description: "Una descripción comercial clara.",
  brand: "Marca Sur",
  categoryId: "category-frozen",
  salePrice: 5990,
  minimumStock: 5,
  imageUrl: "https://example.com/product.jpg",
  published: true,
  active: true,
} as const;

describe("productFormSchema", () => {
  it("accepts valid commercial fields and excludes direct stock", () => {
    const parsed = productFormSchema.parse(validValues);
    const input = toProductCommercialInput(parsed);

    expect(input).toEqual(validValues);
    expect("availableStock" in productFormSchema.shape).toBe(false);
    expect("availableStock" in input).toBe(false);
  });

  it.each([
    ["uppercase slug", { ...validValues, slug: "Producto-Invalido" }],
    ["decimal CLP price", { ...validValues, salePrice: 5990.5 }],
    ["negative minimum", { ...validValues, minimumStock: -1 }],
    ["invalid barcode", { ...validValues, barcode: "ABC-123" }],
    ["missing category", { ...validValues, categoryId: "" }],
  ])("rejects %s", (_case, values) => {
    expect(productFormSchema.safeParse(values).success).toBe(false);
  });

  it("normalizes empty optional strings at the service boundary", () => {
    const parsed = productFormSchema.parse({
      ...validValues,
      barcode: "",
      brand: "",
      description: "",
      imageUrl: "",
    });

    expect(toProductCommercialInput(parsed)).toMatchObject({
      barcode: undefined,
      brand: undefined,
      description: undefined,
      imageUrl: undefined,
    });
  });
});
