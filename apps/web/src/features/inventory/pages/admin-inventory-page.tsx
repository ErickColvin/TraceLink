import { ArrowRightLeft, Search, SlidersHorizontal } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { buttonStyles } from "@/components/ui/button-styles";

import { InventoryPagination } from "../components/inventory-pagination";
import { InventoryResults } from "../components/inventory-results";
import {
  INVENTORY_SORT_OPTIONS,
  INVENTORY_STATUSES,
  INVENTORY_EXPIRY_FILTERS,
  type InventoryExpiryFilter,
  type InventorySort,
  type InventoryStatus,
} from "../domain";
import { inventoryStatusPresentation } from "../presentation/inventory-presentation";
import { useInventory, useInventoryCategories } from "../queries/inventory-queries";

const SELECT_STYLES =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm hover:border-ink-300 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60";

const sortLabels: Record<InventorySort, string> = {
  PRODUCT_ASC: "Producto A–Z",
  AVAILABLE_ASC: "Menor disponibilidad",
  AVAILABLE_DESC: "Mayor disponibilidad",
  EXPIRY_ASC: "Vencimiento más próximo",
  UPDATED_DESC: "Actualización reciente",
};

const expiryLabels: Record<InventoryExpiryFilter, string> = {
  WITH_EXPIRY: "Con vencimiento",
  WITHOUT_EXPIRY: "Sin vencimiento",
  EXPIRING: "Próximos a vencer",
  EXPIRED: "Vencidos",
};

function isInventoryStatus(value: string | null): value is InventoryStatus {
  return value !== null && INVENTORY_STATUSES.some((status) => status === value);
}

function isInventorySort(value: string | null): value is InventorySort {
  return value !== null && INVENTORY_SORT_OPTIONS.some((sort) => sort === value);
}

function isInventoryExpiryFilter(
  value: string | null,
): value is InventoryExpiryFilter {
  return (
    value !== null && INVENTORY_EXPIRY_FILTERS.some((filter) => filter === value)
  );
}

function getPositivePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function AdminInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("category") ?? "";
  const location = searchParams.get("location") ?? "";
  const statusValue = searchParams.get("status");
  const sortValue = searchParams.get("sort");
  const expiryValue = searchParams.get("expiry");
  const status = isInventoryStatus(statusValue) ? statusValue : undefined;
  const sort = isInventorySort(sortValue) ? sortValue : "PRODUCT_ASC";
  const expiry = isInventoryExpiryFilter(expiryValue)
    ? expiryValue
    : undefined;
  const page = getPositivePage(searchParams.get("page"));
  const categoriesQuery = useInventoryCategories();
  const inventoryQuery = useInventory({
    search: search || undefined,
    categoryId: categoryId || undefined,
    location: location || undefined,
    expiry,
    statuses: status ? [status] : undefined,
    sort,
    page,
    pageSize: 8,
  });

  function updateFilter(key: string, value: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(key, value);
    else nextParams.delete(key);
    nextParams.delete("page");
    setSearchParams(nextParams, { replace: true });
  }

  function changePage(nextPage: number) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextPage <= 1) nextParams.delete("page");
    else nextParams.set("page", String(nextPage));
    setSearchParams(nextParams);
  }

  function resetFilters() {
    setSearchParams({}, { replace: true });
  }

  const hasFilters = Boolean(
    search || categoryId || location || status || expiry || sortValue,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className={buttonStyles({ variant: "primary" })}
            to="/app/inventory/movements"
          >
            <ArrowRightLeft aria-hidden="true" className="size-4" />
            Registrar movimiento
          </Link>
        }
        description="Consulta existencias por lote y ubicación. El stock solo cambia mediante movimientos auditables."
        eyebrow="Operación"
        title="Inventario"
      />

      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Filtros de inventario
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div className="space-y-2 sm:col-span-2 xl:col-span-1">
              <Label htmlFor="inventory-search">Buscar</Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                />
                <Input
                  className="pl-10"
                  id="inventory-search"
                  onChange={(event) => updateFilter("search", event.target.value)}
                  placeholder="Producto, SKU, lote o ubicación"
                  type="search"
                  value={search}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-location">Ubicación</Label>
              <Input
                id="inventory-location"
                onChange={(event) => updateFilter("location", event.target.value)}
                placeholder="Cámara, pasillo o estante"
                value={location}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-category">Categoría</Label>
              <select
                className={SELECT_STYLES}
                disabled={categoriesQuery.isPending}
                id="inventory-category"
                onChange={(event) => updateFilter("category", event.target.value)}
                value={categoryId}
              >
                <option value="">Todas las categorías</option>
                {categoriesQuery.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-status">Estado</Label>
              <select
                className={SELECT_STYLES}
                id="inventory-status"
                onChange={(event) => updateFilter("status", event.target.value)}
                value={status ?? ""}
              >
                <option value="">Todos los estados</option>
                {INVENTORY_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {inventoryStatusPresentation[option].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-expiry">Vencimiento</Label>
              <select
                className={SELECT_STYLES}
                id="inventory-expiry"
                onChange={(event) => updateFilter("expiry", event.target.value)}
                value={expiry ?? ""}
              >
                <option value="">Cualquier vencimiento</option>
                {INVENTORY_EXPIRY_FILTERS.map((option) => (
                  <option key={option} value={option}>
                    {expiryLabels[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-sort">Ordenar</Label>
              <select
                className={SELECT_STYLES}
                id="inventory-sort"
                onChange={(event) => updateFilter("sort", event.target.value)}
                value={sort}
              >
                {INVENTORY_SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {sortLabels[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {categoriesQuery.isError ? (
            <p className="mt-3 text-xs text-coral-700" role="alert">
              No fue posible cargar las categorías; el resto de filtros sigue disponible.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {inventoryQuery.isPending ? (
        <div className="space-y-3" aria-label="Cargando inventario">
          <LoadingSkeleton className="h-20 rounded-2xl" />
          <LoadingSkeleton className="h-20 rounded-2xl" />
          <LoadingSkeleton className="h-20 rounded-2xl" />
        </div>
      ) : inventoryQuery.isError || !inventoryQuery.data ? (
        <ErrorState
          action={
            <Button onClick={() => void inventoryQuery.refetch()}>
              Reintentar
            </Button>
          }
          description="No pudimos consultar las existencias. Intenta nuevamente."
          title="Inventario no disponible"
        />
      ) : inventoryQuery.data.items.length === 0 ? (
        <EmptyState
          action={
            hasFilters ? (
              <Button onClick={resetFilters} variant="outline">
                Limpiar filtros
              </Button>
            ) : undefined
          }
          description={
            hasFilters
              ? "Prueba con otros términos o elimina uno de los filtros."
              : "Los registros aparecerán cuando exista inventario configurado."
          }
          title="No encontramos registros de inventario"
        />
      ) : (
        <section className="space-y-4" aria-labelledby="inventory-results-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="inventory-results-title" className="font-semibold text-ink-950">
                Existencias por lote
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                {inventoryQuery.data.totalItems} registros encontrados
              </p>
            </div>
            <Badge tone="info">Datos mock operativos</Badge>
          </div>
          <InventoryResults items={inventoryQuery.data.items} />
          <InventoryPagination
            onPageChange={changePage}
            page={inventoryQuery.data.page}
            totalItems={inventoryQuery.data.totalItems}
            totalPages={inventoryQuery.data.totalPages}
          />
        </section>
      )}
    </div>
  );
}
