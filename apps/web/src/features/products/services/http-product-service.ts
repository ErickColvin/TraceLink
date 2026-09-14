import {
  productCategorySchema,
  productPageSchema,
  productSchema,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  type HttpClient,
} from "@/lib/http/http-client";

import type {
  ProductAdminListParams,
  ProductCommercialInput,
  ProductListParams,
} from "../domain";
import type { ProductService } from "./product-service";

const productCategoryListSchema = productCategorySchema.array();
const productListSchema = productSchema.array();

export class HttpProductService implements ProductService {
  constructor(private readonly client: HttpClient) {}

  list(params?: ProductListParams) {
    return this.client.request("/products", {
      responseSchema: productPageSchema,
      ...(params === undefined ? {} : { query: params }),
    });
  }

  listAdmin(params?: ProductAdminListParams) {
    return this.client.request("/staff/products", {
      responseSchema: productPageSchema,
      ...(params === undefined ? {} : { query: params }),
    });
  }

  listCategories() {
    return this.client.request("/products/categories", {
      responseSchema: productCategoryListSchema,
    });
  }

  getById(id: string) {
    return this.client.request(`/staff/products/${encodePathSegment(id)}`, {
      responseSchema: productSchema,
    });
  }

  getBySlug(slug: string) {
    return this.client.request(`/products/${encodePathSegment(slug)}`, {
      responseSchema: productSchema,
    });
  }

  listRelated(slug: string, limit?: number) {
    return this.client.request(
      `/products/${encodePathSegment(slug)}/related`,
      {
        responseSchema: productListSchema,
        ...(limit === undefined ? {} : { query: { limit } }),
      },
    );
  }

  create(input: ProductCommercialInput) {
    return this.client.request("/staff/products", {
      method: "POST",
      body: input,
      csrf: true,
      responseSchema: productSchema,
    });
  }

  update(id: string, input: ProductCommercialInput) {
    return this.client.request(`/staff/products/${encodePathSegment(id)}`, {
      method: "PATCH",
      body: input,
      csrf: true,
      responseSchema: productSchema,
    });
  }

  setActive(id: string, active: boolean) {
    return this.client.request(
      `/staff/products/${encodePathSegment(id)}/active`,
      {
        method: "PATCH",
        body: { active },
        csrf: true,
        responseSchema: productSchema,
      },
    );
  }

  setPublished(id: string, published: boolean) {
    return this.client.request(
      `/staff/products/${encodePathSegment(id)}/publication`,
      {
        method: "PATCH",
        body: { published },
        csrf: true,
        responseSchema: productSchema,
      },
    );
  }
}
