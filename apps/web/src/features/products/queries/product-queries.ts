import { useQuery } from "@tanstack/react-query";

import type { ProductListParams } from "../domain";
import { productService } from "../services";

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (params: ProductListParams) => [...productKeys.lists(), params] as const,
  categories: () => [...productKeys.all, "categories"] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detailById: (id: string) => [...productKeys.details(), "id", id] as const,
  detailBySlug: (slug: string) => [...productKeys.details(), "slug", slug] as const,
  related: (slug: string, limit: number) => [...productKeys.all, "related", slug, limit] as const,
};

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => productService.list(params),
    staleTime: 60_000,
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: productKeys.categories(),
    queryFn: () => productService.listCategories(),
    staleTime: 5 * 60_000,
  });
}

export function useProductById(id: string | undefined) {
  return useQuery({
    queryKey: productKeys.detailById(id ?? ""),
    queryFn: () => {
      if (!id) throw new Error("Se requiere un identificador de producto.");
      return productService.getById(id);
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useProductBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: productKeys.detailBySlug(slug ?? ""),
    queryFn: () => {
      if (!slug) throw new Error("Se requiere un slug de producto.");
      return productService.getBySlug(slug);
    },
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}

export function useRelatedProducts(slug: string | undefined, limit = 4) {
  return useQuery({
    queryKey: productKeys.related(slug ?? "", limit),
    queryFn: () => {
      if (!slug) throw new Error("Se requiere un slug de producto.");
      return productService.listRelated(slug, limit);
    },
    enabled: Boolean(slug) && limit > 0,
    staleTime: 60_000,
  });
}
