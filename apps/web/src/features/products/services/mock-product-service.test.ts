import { describe, expect, it } from "vitest";

import { MockProductService } from "./mock-product-service";

describe("MockProductService", () => {
  it("combines search, category, availability and sorting", async () => {
    const service = new MockProductService();

    const result = await service.list({
      search: "congelados",
      categoryId: "category-frozen",
      availability: "IN_STOCK",
      sort: "PRICE_ASC",
    });

    expect(result.items.map((product) => product.slug)).toEqual([
      "mix-de-berries-congelados-500-g",
    ]);
    expect(result.totalItems).toBe(1);
  });

  it("returns related products without including the selected product", async () => {
    const service = new MockProductService();

    const products = await service.listRelated(
      "empanadas-de-queso-coctel-20-unidades",
      3,
    );

    expect(products).toHaveLength(3);
    expect(products).not.toContainEqual(
      expect.objectContaining({ slug: "empanadas-de-queso-coctel-20-unidades" }),
    );
    expect(products[0]?.categoryId).toBe("category-frozen");
  });
});
