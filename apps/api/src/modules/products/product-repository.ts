import type {
  Product,
  ProductAdminListParams,
  ProductCategory,
  ProductCommercialInput,
  ProductListParams,
  ProductPage,
} from "@tracelink/contracts";
import {
  productCategorySchema,
  productPageSchema,
  productSchema,
} from "@tracelink/contracts";

import type { PostgresDatabase, SqlExecutor } from "../../database/index.js";
import { writeAudit } from "../../shared/audit/audit.js";
import {
  isPostgresUniqueViolation,
  postgresConstraint,
} from "../../shared/database/postgres-errors.js";
import { AppError } from "../../shared/errors/app-error.js";
import {
  paginationMetadata,
  resolvePagination,
} from "../../shared/pagination/pagination.js";

type ProductRow = Readonly<{
  id: string;
  sku: string;
  barcode: string | null;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryId: string;
  salePrice: number;
  minimumStock: number;
  imageUrl: string | null;
  published: boolean;
  active: boolean;
  featured: boolean;
  availableStock: number;
}>;

type CategoryRow = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}>;

type CountRow = Readonly<{ total: number }>;
type IdRow = Readonly<{ id: string }>;

const PRODUCT_COLUMNS = `
  p.id,
  p.sku,
  p.barcode,
  p.slug,
  p.name,
  p.description,
  p.brand,
  p.category_id AS "categoryId",
  p.sale_price AS "salePrice",
  p.minimum_stock AS "minimumStock",
  p.image_url AS "imageUrl",
  p.published,
  p.active,
  p.featured,
  COALESCE(SUM(
    CASE
      WHEN inventory_lot.expiration_date IS NOT NULL
       AND inventory_lot.expiration_date <= CURRENT_DATE THEN 0
      ELSE ib.physical_quantity - ib.reserved_quantity
    END
  ), 0)::integer
    AS "availableStock"`;

const PRODUCT_FROM = `
  FROM products p
  JOIN organizations o ON o.id = p.organization_id
  JOIN categories c
    ON c.organization_id = p.organization_id
   AND c.id = p.category_id
  LEFT JOIN inventory_balances ib
    ON ib.organization_id = p.organization_id
   AND ib.product_id = p.id
  LEFT JOIN inventory_lots inventory_lot
    ON inventory_lot.organization_id = ib.organization_id
   AND inventory_lot.id = ib.lot_id`;

function optional<Value>(value: Value | null): Value | undefined {
  return value === null ? undefined : value;
}

function toProduct(row: ProductRow): Product {
  return productSchema.parse({
    id: row.id,
    sku: row.sku,
    barcode: optional(row.barcode),
    slug: row.slug,
    name: row.name,
    description: optional(row.description),
    brand: optional(row.brand),
    categoryId: row.categoryId,
    salePrice: row.salePrice,
    minimumStock: row.minimumStock,
    imageUrl: optional(row.imageUrl),
    published: row.published,
    active: row.active,
    featured: row.featured,
    availableStock: row.availableStock,
  });
}

function toCategory(row: CategoryRow): ProductCategory {
  return productCategorySchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    imageUrl: optional(row.imageUrl),
  });
}

function addValue(values: unknown[], value: unknown): string {
  values.push(value);
  return `$${values.length}`;
}

function notFound(): AppError {
  return new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "No se encontró el producto solicitado.",
  });
}

function productConflict(error: unknown): AppError | null {
  if (!isPostgresUniqueViolation(error)) return null;
  const constraint = postgresConstraint(error) ?? "";
  const field = constraint.includes("sku")
    ? "sku"
    : constraint.includes("slug")
      ? "slug"
      : constraint.includes("barcode")
        ? "barcode"
        : undefined;
  return new AppError({
    statusCode: 409,
    code: "CONFLICT",
    message: "Ya existe un producto con esos datos únicos.",
    ...(field === undefined
      ? {}
      : { fieldErrors: { [field]: ["Este valor ya está en uso."] } }),
    cause: error,
  });
}

function normalizedInput(input: ProductCommercialInput): ProductCommercialInput {
  return {
    ...input,
    sku: input.sku.toUpperCase(),
    slug: input.slug.toLowerCase(),
    ...(input.active ? {} : { published: false }),
  };
}

type ListRequest =
  | Readonly<{
      type: "public";
      organizationSlug: string;
      params: ProductListParams;
    }>
  | Readonly<{
      type: "staff";
      organizationId: string;
      params: ProductAdminListParams;
    }>;

export class PostgresProductRepository {
  readonly #database: PostgresDatabase;

  constructor(database: PostgresDatabase) {
    this.#database = database;
  }

  listPublic(
    organizationSlug: string,
    params: ProductListParams,
  ): Promise<ProductPage> {
    return this.#list({ type: "public", organizationSlug, params });
  }

  listStaff(
    organizationId: string,
    params: ProductAdminListParams,
  ): Promise<ProductPage> {
    return this.#list({ type: "staff", organizationId, params });
  }

  async #list(request: ListRequest): Promise<ProductPage> {
    const { params } = request;
    const pagination = resolvePagination(params, 12);
    const values: unknown[] = [];
    const conditions: string[] = [];
    const having: string[] = [];

    if (request.type === "public") {
      conditions.push(`o.slug = ${addValue(values, request.organizationSlug)}`);
      conditions.push("o.active", "p.active", "p.published", "c.active");
    } else {
      conditions.push(`p.organization_id = ${addValue(values, request.organizationId)}`);
    }
    if (params.search !== undefined) {
      const marker = addValue(values, `%${params.search}%`);
      conditions.push(
        `(p.name ILIKE ${marker} OR p.sku ILIKE ${marker} OR ` +
          `COALESCE(p.brand, '') ILIKE ${marker})`,
      );
    }
    if (params.categoryId !== undefined) {
      conditions.push(`p.category_id = ${addValue(values, params.categoryId)}`);
    }

    let orderBy: string;
    if (request.type === "public") {
      const publicParams = request.params;
      if (publicParams.featured !== undefined) {
        conditions.push(`p.featured = ${addValue(values, publicParams.featured)}`);
      }
      if (publicParams.availability === "IN_STOCK") {
        having.push("COALESCE(SUM(ib.physical_quantity - ib.reserved_quantity), 0) > 0");
      } else if (publicParams.availability === "OUT_OF_STOCK") {
        having.push("COALESCE(SUM(ib.physical_quantity - ib.reserved_quantity), 0) = 0");
      }
      orderBy = {
        FEATURED: "p.featured DESC, p.name ASC, p.id ASC",
        NAME_ASC: "p.name ASC, p.id ASC",
        NAME_DESC: "p.name DESC, p.id ASC",
        PRICE_ASC: "p.sale_price ASC, p.name ASC, p.id ASC",
        PRICE_DESC: "p.sale_price DESC, p.name ASC, p.id ASC",
      }[publicParams.sort ?? "FEATURED"];
    } else {
      const staffParams = request.params;
      if (staffParams.active === "ACTIVE") conditions.push("p.active");
      if (staffParams.active === "INACTIVE") conditions.push("NOT p.active");
      if (staffParams.publication === "PUBLISHED") conditions.push("p.published");
      if (staffParams.publication === "UNPUBLISHED") conditions.push("NOT p.published");
      orderBy = {
        NAME_ASC: "p.name ASC, p.id ASC",
        NAME_DESC: "p.name DESC, p.id ASC",
        PRICE_ASC: "p.sale_price ASC, p.name ASC, p.id ASC",
        PRICE_DESC: "p.sale_price DESC, p.name ASC, p.id ASC",
        SKU_ASC: "p.sku ASC, p.id ASC",
      }[staffParams.sort ?? "NAME_ASC"];
    }

    const whereSql = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
    const havingSql = having.length === 0 ? "" : `HAVING ${having.join(" AND ")}`;
    const limitMarker = addValue(values, pagination.limit);
    const offsetMarker = addValue(values, pagination.offset);
    const listValues = [...values];
    const filterValues = values.slice(0, -2);
    const grouped = `${PRODUCT_FROM} ${whereSql} GROUP BY p.id ${havingSql}`;

    const [itemsResult, countResult] = await Promise.all([
      this.#database.query<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} ${grouped}
         ORDER BY ${orderBy}
         LIMIT ${limitMarker} OFFSET ${offsetMarker}`,
        listValues,
      ),
      this.#database.query<CountRow>(
        `SELECT COUNT(*)::integer AS total
           FROM (SELECT p.id ${grouped}) product_page`,
        filterValues,
      ),
    ]);
    const totalItems = countResult.rows[0]?.total ?? 0;
    return productPageSchema.parse({
      items: itemsResult.rows.map(toProduct),
      ...paginationMetadata(pagination, totalItems),
    });
  }

  async listCategories(organizationSlug: string): Promise<ProductCategory[]> {
    const result = await this.#database.query<CategoryRow>(
      `SELECT c.id, c.slug, c.name, c.description, c.image_url AS "imageUrl"
         FROM categories c
         JOIN organizations o ON o.id = c.organization_id
        WHERE o.slug = $1 AND o.active AND c.active
        ORDER BY c.name ASC, c.id ASC`,
      [organizationSlug],
    );
    return result.rows.map(toCategory);
  }

  getPublicBySlug(organizationSlug: string, slug: string): Promise<Product> {
    return this.#getOne(
      this.#database,
      "o.slug = $1 AND o.active AND p.slug = $2 AND p.active AND p.published AND c.active",
      [organizationSlug, slug],
    );
  }

  getStaffById(organizationId: string, id: string): Promise<Product> {
    return this.#getOne(
      this.#database,
      "p.organization_id = $1 AND p.id = $2",
      [organizationId, id],
    );
  }

  async listRelated(
    organizationSlug: string,
    slug: string,
    limit: number,
  ): Promise<Product[]> {
    const product = await this.#database.query<Readonly<{ id: string; categoryId: string }>>(
      `SELECT p.id, p.category_id AS "categoryId"
         FROM products p
         JOIN organizations o ON o.id = p.organization_id
         JOIN categories c ON c.organization_id = p.organization_id AND c.id = p.category_id
        WHERE o.slug = $1 AND o.active AND p.slug = $2
          AND p.active AND p.published AND c.active
        LIMIT 1`,
      [organizationSlug, slug],
    );
    const current = product.rows[0];
    if (current === undefined) throw notFound();
    const result = await this.#database.query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM}
        WHERE o.slug = $1 AND o.active AND p.id <> $2
          AND p.active AND p.published AND c.active
          AND (p.category_id = $3 OR p.featured)
        GROUP BY p.id
        ORDER BY (p.category_id = $3) DESC, p.featured DESC, p.name ASC, p.id ASC
        LIMIT $4`,
      [organizationSlug, current.id, current.categoryId, limit],
    );
    return result.rows.map(toProduct);
  }

  async create(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    input: ProductCommercialInput;
    requestId: string;
  }>): Promise<Product> {
    const input = normalizedInput(options.input);
    try {
      return await this.#database.sqlTransaction(async (executor) => {
        await this.#requireCategory(executor, options.organizationId, input.categoryId);
        const result = await executor.query<IdRow>(
          `INSERT INTO products
             (organization_id, category_id, sku, barcode, slug, name,
              description, brand, sale_price, minimum_stock, image_url,
              published, active, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                   now())
           RETURNING id`,
          [
            options.organizationId,
            input.categoryId,
            input.sku,
            input.barcode ?? null,
            input.slug,
            input.name,
            input.description ?? null,
            input.brand ?? null,
            input.salePrice,
            input.minimumStock ?? 0,
            input.imageUrl ?? null,
            input.published,
            input.active,
          ],
        );
        const id = result.rows[0]?.id;
        if (id === undefined) throw new Error("Product insert returned no id.");
        const product = await this.#getOne(
          executor,
          "p.organization_id = $1 AND p.id = $2",
          [options.organizationId, id],
        );
        await writeAudit(executor, {
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          action: "product.create",
          entityType: "Product",
          entityId: id,
          after: product,
          requestId: options.requestId,
        });
        return product;
      });
    } catch (error) {
      throw productConflict(error) ?? error;
    }
  }

  async update(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    productId: string;
    input: ProductCommercialInput;
    requestId: string;
  }>): Promise<Product> {
    const input = normalizedInput(options.input);
    try {
      return await this.#database.sqlTransaction(async (executor) => {
        const before = await this.#getOne(
          executor,
          "p.organization_id = $1 AND p.id = $2",
          [options.organizationId, options.productId],
        );
        await this.#requireCategory(executor, options.organizationId, input.categoryId);
        await executor.query(
          `UPDATE products
              SET category_id = $3, sku = $4, barcode = $5, slug = $6,
                  name = $7, description = $8, brand = $9, sale_price = $10,
                  minimum_stock = $11, image_url = $12, published = $13,
                  active = $14, updated_at = now()
            WHERE organization_id = $1 AND id = $2`,
          [
            options.organizationId,
            options.productId,
            input.categoryId,
            input.sku,
            input.barcode ?? null,
            input.slug,
            input.name,
            input.description ?? null,
            input.brand ?? null,
            input.salePrice,
            input.minimumStock ?? 0,
            input.imageUrl ?? null,
            input.published,
            input.active,
          ],
        );
        const after = await this.#getOne(
          executor,
          "p.organization_id = $1 AND p.id = $2",
          [options.organizationId, options.productId],
        );
        await writeAudit(executor, {
          organizationId: options.organizationId,
          actorUserId: options.actorUserId,
          action: "product.update",
          entityType: "Product",
          entityId: options.productId,
          before,
          after,
          requestId: options.requestId,
        });
        return after;
      });
    } catch (error) {
      throw productConflict(error) ?? error;
    }
  }

  setActive(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    productId: string;
    active: boolean;
    requestId: string;
  }>): Promise<Product> {
    return this.#setStatus({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      productId: options.productId,
      requestId: options.requestId,
      field: "active",
      value: options.active,
    });
  }

  setPublished(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    productId: string;
    published: boolean;
    requestId: string;
  }>): Promise<Product> {
    return this.#setStatus({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      productId: options.productId,
      value: options.published,
      requestId: options.requestId,
      field: "published",
    });
  }

  async #setStatus(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    productId: string;
    requestId: string;
    field: "active" | "published";
    value: boolean;
  }>): Promise<Product> {
    const { value } = options;
    return this.#database.sqlTransaction(async (executor) => {
      const before = await this.#getOne(
        executor,
        "p.organization_id = $1 AND p.id = $2",
        [options.organizationId, options.productId],
      );
      if (options.field === "published" && value && !before.active) {
        throw new AppError({
          statusCode: 409,
          code: "CONFLICT",
          message: "Activa el producto antes de publicarlo.",
        });
      }
      if (options.field === "active") {
        await executor.query(
          `UPDATE products
              SET active = $3,
                  published = CASE WHEN $3 THEN published ELSE false END,
                  updated_at = now()
            WHERE organization_id = $1 AND id = $2`,
          [options.organizationId, options.productId, value],
        );
      } else {
        await executor.query(
          `UPDATE products SET published = $3, updated_at = now()
            WHERE organization_id = $1 AND id = $2`,
          [options.organizationId, options.productId, value],
        );
      }
      const after = await this.#getOne(
        executor,
        "p.organization_id = $1 AND p.id = $2",
        [options.organizationId, options.productId],
      );
      await writeAudit(executor, {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: options.field === "active" ? "product.active" : "product.publication",
        entityType: "Product",
        entityId: options.productId,
        before,
        after,
        requestId: options.requestId,
      });
      return after;
    });
  }

  async #getOne(
    executor: SqlExecutor,
    where: string,
    values: readonly unknown[],
  ): Promise<Product> {
    const result = await executor.query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM}
        WHERE ${where}
        GROUP BY p.id
        LIMIT 1`,
      values,
    );
    const row = result.rows[0];
    if (row === undefined) throw notFound();
    return toProduct(row);
  }

  async #requireCategory(
    executor: SqlExecutor,
    organizationId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await executor.query<IdRow>(
      `SELECT id FROM categories
        WHERE organization_id = $1 AND id = $2
        LIMIT 1`,
      [organizationId, categoryId],
    );
    if (category.rows[0] === undefined) {
      throw new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "La categoría seleccionada no pertenece a la organización.",
        fieldErrors: { categoryId: ["Selecciona una categoría válida."] },
      });
    }
  }
}
