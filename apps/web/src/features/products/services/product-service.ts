import type {
  Product,
  ProductCategory,
  ProductListParams,
  ProductPage,
} from "../domain";

export interface ProductService {
  list(params?: ProductListParams): Promise<ProductPage>;
  listCategories(): Promise<ProductCategory[]>;
  getById(id: string): Promise<Product>;
  getBySlug(slug: string): Promise<Product>;
  listRelated(slug: string, limit?: number): Promise<Product[]>;
}

export class ProductNotFoundError extends Error {
  constructor(identifier: string) {
    super(`No se encontró el producto '${identifier}'.`);
    this.name = "ProductNotFoundError";
  }
}
