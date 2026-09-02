import type {
  Product,
  ProductAdminListParams,
  ProductCategory,
  ProductCommercialInput,
  ProductListParams,
  ProductPage,
} from "@tracelink/contracts";

import { PostgresProductRepository } from "./product-repository.js";

export class ProductService {
  readonly #repository: PostgresProductRepository;
  readonly #organizationSlug: string;

  constructor(repository: PostgresProductRepository, organizationSlug: string) {
    this.#repository = repository;
    this.#organizationSlug = organizationSlug;
  }

  listPublic(params: ProductListParams): Promise<ProductPage> {
    return this.#repository.listPublic(this.#organizationSlug, params);
  }

  listStaff(organizationId: string, params: ProductAdminListParams): Promise<ProductPage> {
    return this.#repository.listStaff(organizationId, params);
  }

  listCategories(): Promise<ProductCategory[]> {
    return this.#repository.listCategories(this.#organizationSlug);
  }

  getPublicBySlug(slug: string): Promise<Product> {
    return this.#repository.getPublicBySlug(this.#organizationSlug, slug);
  }

  getStaffById(organizationId: string, id: string): Promise<Product> {
    return this.#repository.getStaffById(organizationId, id);
  }

  listRelated(slug: string, limit = 4): Promise<Product[]> {
    return this.#repository.listRelated(this.#organizationSlug, slug, limit);
  }

  create(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    input: ProductCommercialInput;
    requestId: string;
  }>): Promise<Product> {
    return this.#repository.create(options);
  }

  update(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    productId: string;
    input: ProductCommercialInput;
    requestId: string;
  }>): Promise<Product> {
    return this.#repository.update(options);
  }

  setActive(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    productId: string;
    active: boolean;
    requestId: string;
  }>): Promise<Product> {
    return this.#repository.setActive(options);
  }

  setPublished(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    productId: string;
    published: boolean;
    requestId: string;
  }>): Promise<Product> {
    return this.#repository.setPublished(options);
  }
}
