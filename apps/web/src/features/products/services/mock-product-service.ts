import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import { mockProductCategories, mockProducts } from "../data/mock-products";
import type {
  Product,
  ProductAdminListParams,
  ProductAdminSort,
  ProductCategory,
  ProductCommercialInput,
  ProductListParams,
  ProductPage,
  ProductSort,
} from "../domain";
import {
  ProductConflictError,
  ProductNotFoundError,
  ProductStateError,
  type ProductConflictField,
  type ProductService,
} from "./product-service";

const DEFAULT_PAGE_SIZE = 12;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase(tenantBrand.locale);
}

function copyProduct(product: Product): Product {
  return { ...product };
}

function sortProducts(products: Product[], sort: ProductSort): Product[] {
  return products.sort((left, right) => {
    switch (sort) {
      case "NAME_ASC":
        return left.name.localeCompare(right.name, tenantBrand.locale);
      case "NAME_DESC":
        return right.name.localeCompare(left.name, tenantBrand.locale);
      case "PRICE_ASC":
        return left.salePrice - right.salePrice;
      case "PRICE_DESC":
        return right.salePrice - left.salePrice;
      case "FEATURED":
        return Number(right.featured) - Number(left.featured) || left.name.localeCompare(right.name, tenantBrand.locale);
    }
  });
}

function sortAdminProducts(products: Product[], sort: ProductAdminSort): Product[] {
  return products.sort((left, right) => {
    switch (sort) {
      case "NAME_ASC":
        return left.name.localeCompare(right.name, tenantBrand.locale);
      case "NAME_DESC":
        return right.name.localeCompare(left.name, tenantBrand.locale);
      case "PRICE_ASC":
        return left.salePrice - right.salePrice;
      case "PRICE_DESC":
        return right.salePrice - left.salePrice;
      case "SKU_ASC":
        return left.sku.localeCompare(right.sku, tenantBrand.locale);
    }
  });
}

function createPage(
  products: Product[],
  page: number,
  pageSize: number,
): ProductPage {
  const totalItems = products.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: products.slice(start, start + pageSize).map(copyProduct),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeCommercialInput(
  input: ProductCommercialInput,
): ProductCommercialInput {
  return {
    ...input,
    sku: input.sku.trim().toLocaleUpperCase(tenantBrand.locale),
    barcode: normalizeOptional(input.barcode),
    slug: input.slug.trim().toLocaleLowerCase(tenantBrand.locale),
    name: input.name.trim(),
    description: normalizeOptional(input.description),
    brand: normalizeOptional(input.brand),
    categoryId: input.categoryId.trim(),
    salePrice: Math.round(input.salePrice),
    minimumStock:
      input.minimumStock === undefined ? undefined : Math.round(input.minimumStock),
    imageUrl: normalizeOptional(input.imageUrl),
  };
}

export class MockProductService implements ProductService {
  private readonly products: Product[];

  constructor(
    initialProducts: readonly Product[] = mockProducts,
    private readonly readAvailableStock?: (
      productId: string,
    ) => number | undefined,
  ) {
    this.products = initialProducts.map(copyProduct);
  }

  async list(params: ProductListParams = {}): Promise<ProductPage> {
    await delay(180);

    const search = params.search ? normalizeText(params.search) : undefined;
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));

    const filtered = this.products
      .map((product) => this.withCurrentStock(product))
      .filter((product) => product.active && product.published)
      .filter((product) => {
        if (!search) return true;
        return normalizeText(`${product.name} ${product.brand ?? ""} ${product.sku}`).includes(search);
      })
      .filter((product) => !params.categoryId || product.categoryId === params.categoryId)
      .filter((product) => {
        if (!params.availability || params.availability === "ALL") return true;
        return params.availability === "IN_STOCK"
          ? product.availableStock > 0
          : product.availableStock === 0;
      })
      .filter((product) => params.featured === undefined || product.featured === params.featured);

    const sorted = sortProducts(filtered, params.sort ?? "FEATURED");
    return createPage(sorted, page, pageSize);
  }

  async listAdmin(params: ProductAdminListParams = {}): Promise<ProductPage> {
    await delay(180);

    const search = params.search ? normalizeText(params.search) : undefined;
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));

    const filtered = this.products
      .map((product) => this.withCurrentStock(product))
      .filter((product) => {
        if (!search) return true;
        return normalizeText(
          `${product.name} ${product.brand ?? ""} ${product.sku} ${product.barcode ?? ""}`,
        ).includes(search);
      })
      .filter((product) => !params.categoryId || product.categoryId === params.categoryId)
      .filter((product) => {
        if (!params.active || params.active === "ALL") return true;
        return params.active === "ACTIVE" ? product.active : !product.active;
      })
      .filter((product) => {
        if (!params.publication || params.publication === "ALL") return true;
        return params.publication === "PUBLISHED" ? product.published : !product.published;
      });

    return createPage(
      sortAdminProducts(filtered, params.sort ?? "NAME_ASC"),
      page,
      pageSize,
    );
  }

  async listCategories(): Promise<ProductCategory[]> {
    await delay(100);
    return mockProductCategories.map((category) => ({ ...category }));
  }

  async getById(id: string): Promise<Product> {
    await delay(140);
    const product = this.products.find((candidate) => candidate.id === id);

    if (!product) throw new ProductNotFoundError(id);
    return this.withCurrentStock(product);
  }

  async getBySlug(slug: string): Promise<Product> {
    await delay(140);
    const product = this.products.find(
      (candidate) => candidate.slug === slug && candidate.active && candidate.published,
    );

    if (!product) throw new ProductNotFoundError(slug);
    return this.withCurrentStock(product);
  }

  async listRelated(slug: string, limit = 4): Promise<Product[]> {
    await delay(120);
    const product = this.products.find(
      (candidate) => candidate.slug === slug && candidate.active && candidate.published,
    );

    if (!product) throw new ProductNotFoundError(slug);

    const safeLimit = Math.max(0, Math.trunc(limit));
    const published = this.products.filter(
      (candidate) => candidate.id !== product.id && candidate.active && candidate.published,
    );
    const sameCategory = published.filter((candidate) => candidate.categoryId === product.categoryId);
    const otherFeatured = published.filter(
      (candidate) => candidate.categoryId !== product.categoryId && candidate.featured,
    );

    return [...sameCategory, ...otherFeatured]
      .slice(0, safeLimit)
      .map((candidate) => this.withCurrentStock(candidate));
  }


  async create(input: ProductCommercialInput): Promise<Product> {
    await delay(180);
    const normalized = normalizeCommercialInput(input);
    this.assertUnique(normalized);

    const idBase = normalized.slug || `producto-${this.products.length + 1}`;
    let id = `product-${idBase}`;
    let suffix = 2;
    while (this.products.some((product) => product.id === id)) {
      id = `product-${idBase}-${suffix}`;
      suffix += 1;
    }

    const product: Product = {
      ...normalized,
      id,
      availableStock: 0,
      featured: false,
    };

    this.products.unshift(product);
    return this.withCurrentStock(product);
  }

  async update(id: string, input: ProductCommercialInput): Promise<Product> {
    await delay(180);
    const index = this.findIndex(id);
    const normalized = normalizeCommercialInput(input);
    this.assertUnique(normalized, id);

    const current = this.products[index];
    if (!current) throw new ProductNotFoundError(id);

    const updated: Product = {
      ...current,
      ...normalized,
      published: normalized.active ? normalized.published : false,
    };
    this.products[index] = updated;
    return this.withCurrentStock(updated);
  }

  async setActive(id: string, active: boolean): Promise<Product> {
    await delay(150);
    const index = this.findIndex(id);
    const current = this.products[index];
    if (!current) throw new ProductNotFoundError(id);

    const updated: Product = {
      ...current,
      active,
      published: active ? current.published : false,
    };
    this.products[index] = updated;
    return this.withCurrentStock(updated);
  }

  async setPublished(id: string, published: boolean): Promise<Product> {
    await delay(150);
    const index = this.findIndex(id);
    const current = this.products[index];
    if (!current) throw new ProductNotFoundError(id);
    if (published && !current.active) {
      throw new ProductStateError(
        "Activa el producto antes de publicarlo en la tienda.",
      );
    }

    const updated: Product = { ...current, published };
    this.products[index] = updated;
    return this.withCurrentStock(updated);
  }

  private withCurrentStock(product: Product): Product {
    const availableStock = this.readAvailableStock
      ? (this.readAvailableStock(product.id) ?? 0)
      : product.availableStock;

    return { ...product, availableStock };
  }

  private findIndex(id: string): number {
    const index = this.products.findIndex((product) => product.id === id);
    if (index < 0) throw new ProductNotFoundError(id);
    return index;
  }

  private assertUnique(input: ProductCommercialInput, currentId?: string): void {
    const checks: readonly [ProductConflictField, string | undefined][] = [
      ["sku", input.sku],
      ["slug", input.slug],
      ["barcode", input.barcode],
    ];

    for (const [field, value] of checks) {
      if (!value) continue;
      const normalizedValue = normalizeText(value);
      const duplicate = this.products.some(
        (product) =>
          product.id !== currentId &&
          normalizeText(product[field] ?? "") === normalizedValue,
      );
      if (duplicate) throw new ProductConflictError(field);
    }
  }
}
