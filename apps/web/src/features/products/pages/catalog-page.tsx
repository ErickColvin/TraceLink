import { useMemo, useState } from "react";
import { FilterX, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { EmptyState, ErrorState, PageHeader } from "@/components";
import { Button, Card, CardContent, Input, Label } from "@/components/ui";
import { ProductCard } from "@/features/products/components/product-card";
import { ProductGridSkeleton } from "@/features/products/components/product-grid-skeleton";
import {
  useProductCategories,
  useProducts,
  type ProductAvailability,
  type ProductSort,
} from "@/features/products";

const selectClassName =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

export function CatalogPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(
    () => searchParams.get("categoria") ?? "",
  );
  const [availability, setAvailability] = useState<ProductAvailability>("ALL");
  const [sort, setSort] = useState<ProductSort>("FEATURED");

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      categoryId: categoryId || undefined,
      availability,
      sort,
      pageSize: 24,
    }),
    [availability, categoryId, search, sort],
  );

  const productsQuery = useProducts(params);
  const categoriesQuery = useProductCategories();
  const categoriesById = useMemo(
    () => new Map(categoriesQuery.data?.map((category) => [category.id, category.name]) ?? []),
    [categoriesQuery.data],
  );
  const hasFilters = Boolean(search || categoryId || availability !== "ALL" || sort !== "FEATURED");

  const clearFilters = () => {
    setSearch("");
    setCategoryId("");
    setAvailability("ALL");
    setSort("FEATURED");
  };

  return (
    <div className="min-h-[70vh] bg-ice-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <PageHeader
          eyebrow={`Catálogo ${tenantBrand.name}`}
          title="Encuentra lo que necesitas, sin vueltas"
          description="Consulta productos, disponibilidad y precios actualizados en esta experiencia demostrativa."
        />

        <Card className="mt-7">
          <CardContent className="grid gap-4 pt-5 sm:pt-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] lg:items-end">
            <div>
              <Label htmlFor="catalog-search">Buscar producto</Label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                <Input
                  id="catalog-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, marca o SKU"
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="catalog-category">Categoría</Label>
              <select id="catalog-category" className={selectClassName} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Todas</option>
                {categoriesQuery.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="catalog-availability">Disponibilidad</Label>
              <select id="catalog-availability" className={selectClassName} value={availability} onChange={(event) => setAvailability(event.target.value as ProductAvailability)}>
                <option value="ALL">Todos</option>
                <option value="IN_STOCK">Disponible</option>
                <option value="OUT_OF_STOCK">Sin stock</option>
              </select>
            </div>
            <div>
              <Label htmlFor="catalog-sort">Ordenar</Label>
              <select id="catalog-sort" className={selectClassName} value={sort} onChange={(event) => setSort(event.target.value as ProductSort)}>
                <option value="FEATURED">Destacados</option>
                <option value="NAME_ASC">Nombre A–Z</option>
                <option value="PRICE_ASC">Menor precio</option>
                <option value="PRICE_DESC">Mayor precio</option>
              </select>
            </div>
            <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters}>
              <FilterX aria-hidden="true" /> Limpiar
            </Button>
          </CardContent>
        </Card>

        <div className="mt-7 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-600" role="status" aria-live="polite">
            {productsQuery.isPending ? "Buscando productos…" : `${productsQuery.data?.totalItems ?? 0} productos encontrados`}
          </p>
          <span className="hidden items-center gap-2 text-sm text-ink-500 sm:flex"><SlidersHorizontal aria-hidden="true" className="size-4" /> Filtros activos: {hasFilters ? "sí" : "no"}</span>
        </div>

        <div className="mt-5">
          {productsQuery.isPending || categoriesQuery.isPending ? <ProductGridSkeleton count={8} /> : null}
          {productsQuery.isError || categoriesQuery.isError ? (
            <ErrorState
              title="No pudimos cargar el catálogo"
              description="Revisa tu conexión e inténtalo nuevamente."
              action={<Button onClick={() => { void productsQuery.refetch(); void categoriesQuery.refetch(); }}>Reintentar</Button>}
            />
          ) : null}
          {productsQuery.data?.items.length === 0 ? (
            <EmptyState
              title="No hay productos para estos filtros"
              description="Prueba con otra búsqueda o vuelve a ver el catálogo completo."
              action={<Button onClick={clearFilters}>Quitar filtros</Button>}
            />
          ) : null}
          {productsQuery.data && productsQuery.data.items.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productsQuery.data.items.map((product) => (
                <ProductCard key={product.id} product={product} categoryName={categoriesById.get(product.categoryId)} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
