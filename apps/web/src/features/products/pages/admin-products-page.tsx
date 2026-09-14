import { useMemo, useState } from "react";
import { FilterX, PackageSearch, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";

import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  buttonStyles,
} from "@/components/ui";
import { useHasPermission } from "@/features/auth";

import { AdminProductList } from "../components/admin-product-list";
import { AdminProductPagination } from "../components/admin-product-pagination";
import type {
  Product,
  ProductActiveFilter,
  ProductAdminListParams,
  ProductAdminSort,
  ProductPublicationFilter,
} from "../domain";
import {
  PRODUCT_ACTIVE_FILTERS,
  PRODUCT_ADMIN_SORT_OPTIONS,
  PRODUCT_PUBLICATION_FILTERS,
} from "../domain";
import {
  useAdminProducts,
  useProductCategories,
  useSetProductActive,
  useSetProductPublished,
} from "../queries/product-queries";

const PAGE_SIZE = 8;
const selectClassName =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

type PendingProductAction = Readonly<{
  kind: "active" | "published";
  product: Product;
}>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No pudimos completar el cambio. Inténtalo nuevamente.";
}

export function AdminProductsPage() {
  const canCreate = useHasPermission("products.create");
  const canUpdate = useHasPermission("products.update");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [active, setActive] = useState<ProductActiveFilter>("ALL");
  const [publication, setPublication] =
    useState<ProductPublicationFilter>("ALL");
  const [sort, setSort] = useState<ProductAdminSort>("NAME_ASC");
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] =
    useState<PendingProductAction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");

  const params = useMemo<ProductAdminListParams>(
    () => ({
      search: search.trim() || undefined,
      categoryId: categoryId || undefined,
      active,
      publication,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    [active, categoryId, page, publication, search, sort],
  );
  const productsQuery = useAdminProducts(params);
  const categoriesQuery = useProductCategories();
  const activeMutation = useSetProductActive();
  const publicationMutation = useSetProductPublished();
  const mutationPending = activeMutation.isPending || publicationMutation.isPending;
  const categoriesById = useMemo(
    () =>
      new Map(
        categoriesQuery.data?.map((category) => [category.id, category.name]) ?? [],
      ),
    [categoriesQuery.data],
  );
  const hasFilters = Boolean(
    search ||
      categoryId ||
      active !== "ALL" ||
      publication !== "ALL" ||
      sort !== "NAME_ASC",
  );

  const changeFilter = (change: () => void) => {
    change();
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryId("");
    setActive("ALL");
    setPublication("ALL");
    setSort("NAME_ASC");
    setPage(1);
  };

  const requestAction = (action: PendingProductAction) => {
    setFeedback("");
    setActionError("");
    setPendingAction(action);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const { kind, product } = pendingAction;

    try {
      if (kind === "active") {
        const nextActive = !product.active;
        await activeMutation.mutateAsync({ id: product.id, active: nextActive });
        setFeedback(
          nextActive
            ? `${product.name} quedó activo.`
            : `${product.name} fue desactivado y retirado de la tienda.`,
        );
      } else {
        const nextPublished = !product.published;
        await publicationMutation.mutateAsync({
          id: product.id,
          published: nextPublished,
        });
        setFeedback(
          nextPublished
            ? `${product.name} ahora está publicado.`
            : `${product.name} fue despublicado.`,
        );
      }
      setPendingAction(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
      setPendingAction(null);
    }
  };

  const confirmationTitle = pendingAction
    ? pendingAction.kind === "active"
      ? pendingAction.product.active
        ? "Desactivar producto"
        : "Activar producto"
      : pendingAction.product.published
        ? "Despublicar producto"
        : "Publicar producto"
    : "Confirmar cambio";
  const confirmationDescription = pendingAction
    ? pendingAction.kind === "active" && pendingAction.product.active
      ? "El producto dejará de estar disponible para la operación y se despublicará de la tienda. No se eliminará su historial."
      : `Confirma el cambio de visibilidad para ${pendingAction.product.name}.`
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catálogo operativo"
        title="Productos"
        description="Administra la información comercial. El stock mostrado es de solo lectura y cambia exclusivamente desde Inventario."
        actions={
          canCreate ? (
            <Link className={buttonStyles()} to="/app/products/new">
              <Plus aria-hidden="true" /> Nuevo producto
            </Link>
          ) : null
        }
      />

      {feedback ? (
        <Alert aria-live="polite" role="status" tone="success">
          <p>{feedback}</p>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert tone="danger">
          <p>{actionError}</p>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:pt-6 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)_auto] xl:items-end">
          <div>
            <Label htmlFor="admin-product-search">Buscar</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              />
              <Input
                className="pl-10"
                id="admin-product-search"
                type="search"
                value={search}
                onChange={(event) =>
                  changeFilter(() => setSearch(event.target.value))
                }
                placeholder="Nombre, SKU, barcode o marca"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="admin-product-category">Categoría</Label>
            <select
              className={selectClassName}
              id="admin-product-category"
              value={categoryId}
              onChange={(event) =>
                changeFilter(() => setCategoryId(event.target.value))
              }
            >
              <option value="">Todas</option>
              {categoriesQuery.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="admin-product-active">Estado</Label>
            <select
              className={selectClassName}
              id="admin-product-active"
              value={active}
              onChange={(event) => {
                const nextActive = PRODUCT_ACTIVE_FILTERS.find(
                  (candidate) => candidate === event.currentTarget.value,
                );
                if (nextActive) changeFilter(() => setActive(nextActive));
              }}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </div>
          <div>
            <Label htmlFor="admin-product-publication">Publicación</Label>
            <select
              className={selectClassName}
              id="admin-product-publication"
              value={publication}
              onChange={(event) => {
                const nextPublication = PRODUCT_PUBLICATION_FILTERS.find(
                  (candidate) => candidate === event.currentTarget.value,
                );
                if (nextPublication) {
                  changeFilter(() => setPublication(nextPublication));
                }
              }}
            >
              <option value="ALL">Todos</option>
              <option value="PUBLISHED">Publicados</option>
              <option value="UNPUBLISHED">No publicados</option>
            </select>
          </div>
          <div>
            <Label htmlFor="admin-product-sort">Orden</Label>
            <select
              className={selectClassName}
              id="admin-product-sort"
              value={sort}
              onChange={(event) => {
                const nextSort = PRODUCT_ADMIN_SORT_OPTIONS.find(
                  (candidate) => candidate === event.currentTarget.value,
                );
                if (nextSort) changeFilter(() => setSort(nextSort));
              }}
            >
              <option value="NAME_ASC">Nombre A–Z</option>
              <option value="NAME_DESC">Nombre Z–A</option>
              <option value="SKU_ASC">SKU A–Z</option>
              <option value="PRICE_ASC">Menor precio</option>
              <option value="PRICE_DESC">Mayor precio</option>
            </select>
          </div>
          <Button disabled={!hasFilters} onClick={clearFilters} variant="ghost">
            <FilterX aria-hidden="true" /> Limpiar
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p aria-live="polite" className="text-sm text-ink-600" role="status">
          {productsQuery.isPending
            ? "Cargando productos…"
            : `${productsQuery.data?.totalItems ?? 0} productos encontrados`}
        </p>
        <p className="hidden text-xs text-ink-500 sm:block">
          Existencias de solo lectura
        </p>
      </div>

      {productsQuery.isPending || categoriesQuery.isPending ? (
        <div className="space-y-3" aria-label="Cargando listado de productos">
          {Array.from({ length: 5 }, (_, index) => (
            <LoadingSkeleton className="h-24 rounded-2xl" key={index} />
          ))}
        </div>
      ) : null}

      {productsQuery.isError || categoriesQuery.isError ? (
        <ErrorState
          title="No pudimos cargar los productos"
          description="Reintenta para recuperar el catálogo operativo y sus categorías."
          action={
            <Button
              onClick={() => {
                void productsQuery.refetch();
                void categoriesQuery.refetch();
              }}
            >
              Reintentar
            </Button>
          }
        />
      ) : null}

      {productsQuery.data?.items.length === 0 ? (
        <EmptyState
          icon={<PackageSearch />}
          title="No hay productos para estos filtros"
          description="Ajusta la búsqueda o vuelve al listado completo."
          action={
            hasFilters ? <Button onClick={clearFilters}>Quitar filtros</Button> : undefined
          }
        />
      ) : null}

      {productsQuery.data && productsQuery.data.items.length > 0 ? (
        <div className="space-y-5">
          <AdminProductList
            canUpdate={canUpdate}
            categoriesById={categoriesById}
            pendingProductId={
              mutationPending ? pendingAction?.product.id : undefined
            }
            products={productsQuery.data.items}
            onRequestActiveChange={(product) =>
              requestAction({ kind: "active", product })
            }
            onRequestPublishedChange={(product) =>
              requestAction({ kind: "published", product })
            }
          />
          <AdminProductPagination
            disabled={productsQuery.isFetching}
            page={productsQuery.data.page}
            pageSize={productsQuery.data.pageSize}
            totalItems={productsQuery.data.totalItems}
            totalPages={productsQuery.data.totalPages}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      <ConfirmationDialog
        confirmLabel="Confirmar cambio"
        description={confirmationDescription}
        onConfirm={() => {
          void confirmAction();
        }}
        onOpenChange={(open) => {
          if (!open && !mutationPending) setPendingAction(null);
        }}
        open={pendingAction !== null}
        pending={mutationPending}
        title={confirmationTitle}
        tone={
          pendingAction?.kind === "active" && pendingAction.product.active
            ? "danger"
            : "primary"
        }
      />
    </div>
  );
}
