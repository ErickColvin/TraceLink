import { describe, expect, it } from "vitest";

import { MockProductService } from "./mock-product-service";

const newProduct = {
  sku: "TEST-001",
  barcode: "7801234567890",
  slug: "producto-de-prueba",
  name: "Producto de prueba",
  description: "Producto creado desde el formulario administrativo.",
  brand: "Marca Demo",
  categoryId: "category-pantry",
  salePrice: 3990,
  minimumStock: 4,
  imageUrl: "https://example.com/producto.jpg",
  published: false,
  active: true,
} as const;

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

  it("creates commercial data with zero stock and exposes it only to staff until published", async () => {
    const service = new MockProductService();

    const created = await service.create(newProduct);
    const publicProducts = await service.list({ search: newProduct.sku });
    const adminProducts = await service.listAdmin({ search: newProduct.sku });

    expect(created).toMatchObject({
      sku: newProduct.sku,
      availableStock: 0,
      featured: false,
    });
    expect(publicProducts.totalItems).toBe(0);
    expect(adminProducts.items).toEqual([
      expect.objectContaining({ id: created.id, availableStock: 0 }),
    ]);
  });

  it("rejects duplicate commercial identifiers", async () => {
    const service = new MockProductService();
    await service.create(newProduct);

    await expect(
      service.create({
        ...newProduct,
        slug: "otro-slug",
        barcode: "7809876543210",
      }),
    ).rejects.toMatchObject({ name: "ProductConflictError", field: "sku" });
  });

  it("deactivates without deleting and automatically unpublishes", async () => {
    const service = new MockProductService();
    const before = await service.getById("product-empanadas-queso");

    const deactivated = await service.setActive(before.id, false);
    const staffResult = await service.listAdmin({ active: "INACTIVE" });

    expect(deactivated).toMatchObject({ active: false, published: false });
    expect(staffResult.items).toContainEqual(
      expect.objectContaining({ id: before.id }),
    );
    await expect(service.getBySlug(before.slug)).rejects.toMatchObject({
      name: "ProductNotFoundError",
    });
  });

  it("blocks publishing an inactive product", async () => {
    const service = new MockProductService();
    const product = await service.setActive("product-berries", false);

    await expect(service.setPublished(product.id, true)).rejects.toMatchObject({
      name: "ProductStateError",
    });
  });

  it("filters, sorts and paginates the complete staff catalogue", async () => {
    const service = new MockProductService();
    await service.setPublished("product-papas", false);

    const firstPage = await service.listAdmin({
      categoryId: "category-frozen",
      publication: "UNPUBLISHED",
      sort: "PRICE_DESC",
      page: 1,
      pageSize: 1,
    });

    expect(firstPage).toMatchObject({
      page: 1,
      pageSize: 1,
      totalItems: 1,
      totalPages: 1,
    });
    expect(firstPage.items[0]?.id).toBe("product-papas");
  });
});
