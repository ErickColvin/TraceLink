import type {
  Product,
  ProductAdminListParams,
  ProductCategory,
  ProductCommercialInput,
  ProductListParams,
  ProductPage,
} from "../domain";

export interface ProductService {
  list(params?: ProductListParams): Promise<ProductPage>;
  listAdmin(params?: ProductAdminListParams): Promise<ProductPage>;
  listCategories(): Promise<ProductCategory[]>;
  getById(id: string): Promise<Product>;
  getBySlug(slug: string): Promise<Product>;
  listRelated(slug: string, limit?: number): Promise<Product[]>;
  create(input: ProductCommercialInput): Promise<Product>;
  update(id: string, input: ProductCommercialInput): Promise<Product>;
  setActive(id: string, active: boolean): Promise<Product>;
  setPublished(id: string, published: boolean): Promise<Product>;
}

export type ProductConflictField = "sku" | "slug" | "barcode";

export class ProductConflictError extends Error {
  readonly field: ProductConflictField;

  constructor(field: ProductConflictField) {
    const labels: Record<ProductConflictField, string> = {
      sku: "SKU",
      slug: "slug",
      barcode: "código de barras",
    };

    super(`Ya existe un producto con ese ${labels[field]}.`);
    this.name = "ProductConflictError";
    this.field = field;
  }
}

export class ProductStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductStateError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(identifier: string) {
    super(`No se encontró el producto '${identifier}'.`);
    this.name = "ProductNotFoundError";
  }
}
