import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import { mockProductCategories, mockProducts } from "../data/mock-products";
import type {
  Product,
  ProductCategory,
  ProductListParams,
  ProductPage,
  ProductSort,
} from "../domain";
import { ProductNotFoundError, type ProductService } from "./product-service";

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

export class MockProductService implements ProductService {
  async list(params: ProductListParams = {}): Promise<ProductPage> {
    await delay(180);

    const search = params.search ? normalizeText(params.search) : undefined;
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));

    const filtered = mockProducts
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
      .filter((product) => params.featured === undefined || product.featured === params.featured)
      .map(copyProduct);

    const sorted = sortProducts(filtered, params.sort ?? "FEATURED");
    const totalItems = sorted.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const start = (page - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async listCategories(): Promise<ProductCategory[]> {
    await delay(100);
    return mockProductCategories.map((category) => ({ ...category }));
  }

  async getById(id: string): Promise<Product> {
    await delay(140);
    const product = mockProducts.find((candidate) => candidate.id === id && candidate.active);

    if (!product) throw new ProductNotFoundError(id);
    return copyProduct(product);
  }

  async getBySlug(slug: string): Promise<Product> {
    await delay(140);
    const product = mockProducts.find(
      (candidate) => candidate.slug === slug && candidate.active && candidate.published,
    );

    if (!product) throw new ProductNotFoundError(slug);
    return copyProduct(product);
  }

  async listRelated(slug: string, limit = 4): Promise<Product[]> {
    await delay(120);
    const product = mockProducts.find(
      (candidate) => candidate.slug === slug && candidate.active && candidate.published,
    );

    if (!product) throw new ProductNotFoundError(slug);

    const safeLimit = Math.max(0, Math.trunc(limit));
    const published = mockProducts.filter(
      (candidate) => candidate.id !== product.id && candidate.active && candidate.published,
    );
    const sameCategory = published.filter((candidate) => candidate.categoryId === product.categoryId);
    const otherFeatured = published.filter(
      (candidate) => candidate.categoryId !== product.categoryId && candidate.featured,
    );

    return [...sameCategory, ...otherFeatured].slice(0, safeLimit).map(copyProduct);
  }
}
