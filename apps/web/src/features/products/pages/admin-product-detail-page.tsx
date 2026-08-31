import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  PackageSearch,
  Pencil,
  Power,
  Radio,
  Warehouse,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
  ConfirmationDialog,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  buttonStyles,
} from "@/components/ui";
import { useHasPermission } from "@/features/auth";
import { formatClp } from "@/lib/formatters";

import { ProductStatusBadges } from "../components/product-status-badges";
import type { Product } from "../domain";
import {
  useProductById,
  useProductCategories,
  useSetProductActive,
  useSetProductPublished,
} from "../queries/product-queries";

type DetailAction = Readonly<{
  kind: "active" | "published";
  product: Product;
}>;

function readNotice(state: unknown): string | undefined {
  if (typeof state !== "object" || state === null || !("notice" in state)) {
    return undefined;
  }
  const notice = Reflect.get(state, "notice");
  return typeof notice === "string" ? notice : undefined;
}

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No pudimos completar el cambio. Inténtalo nuevamente.";
}

export function AdminProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const canUpdate = useHasPermission("products.update");
  const productQuery = useProductById(id);
  const categoriesQuery = useProductCategories();
  const activeMutation = useSetProductActive();
  const publicationMutation = useSetProductPublished();
  const [action, setAction] = useState<DetailAction | null>(null);
  const [feedback, setFeedback] = useState(() => readNotice(location.state) ?? "");
  const [actionError, setActionError] = useState("");
  const pending = activeMutation.isPending || publicationMutation.isPending;
  const categoryName = useMemo(
    () =>
      categoriesQuery.data?.find(
        (category) => category.id === productQuery.data?.categoryId,
      )?.name,
    [categoriesQuery.data, productQuery.data?.categoryId],
  );

  const openAction = (next: DetailAction) => {
    setFeedback("");
    setActionError("");
    setAction(next);
  };

  const confirmAction = async () => {
    if (!action) return;
    const { kind, product } = action;
    try {
      if (kind === "active") {
        const next = !product.active;
        await activeMutation.mutateAsync({ id: product.id, active: next });
        setFeedback(
          next
            ? "Producto activado correctamente."
            : "Producto desactivado y despublicado correctamente.",
        );
      } else {
        const next = !product.published;
        await publicationMutation.mutateAsync({ id: product.id, published: next });
        setFeedback(
          next
            ? "Producto publicado correctamente."
            : "Producto despublicado correctamente.",
        );
      }
      setAction(null);
    } catch (error) {
      setActionError(mutationErrorMessage(error));
      setAction(null);
    }
  };

  if (productQuery.isPending || categoriesQuery.isPending) {
    return (
      <div aria-label="Cargando detalle de producto" className="space-y-5">
        <LoadingSkeleton className="h-24 rounded-2xl" />
        <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
          <LoadingSkeleton className="h-96 rounded-2xl" />
          <LoadingSkeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (productQuery.isError || !productQuery.data || categoriesQuery.isError) {
    return (
      <ErrorState
        title="No encontramos este producto"
        description="Puede que el registro no exista o no esté disponible en este momento."
        action={
          <Link className={buttonStyles({ variant: "outline" })} to="/app/products">
            <ArrowLeft aria-hidden="true" /> Volver a productos
          </Link>
        }
      />
    );
  }

  const product = productQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Detalle de producto"
        title={product.name}
        description={`SKU ${product.sku}`}
        actions={
          <>
            <Link
              className={buttonStyles({ variant: "outline" })}
              to="/app/products"
            >
              <ArrowLeft aria-hidden="true" /> Volver
            </Link>
            {canUpdate ? (
              <Link
                className={buttonStyles()}
                to={`/app/products/${product.id}/edit`}
              >
                <Pencil aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </>
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
        <Card>
          <CardContent className="pt-5 sm:pt-6">
            <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
              <img
                alt={product.name}
                className="aspect-square w-full rounded-2xl bg-ice-100 object-cover"
                src={product.imageUrl ?? "/assets/ch-market-hero.jpg"}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = "/assets/ch-market-hero.jpg";
                }}
              />
              <div>
                <ProductStatusBadges product={product} />
                <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Categoría</dt>
                    <dd className="mt-1 font-medium text-ink-950">{categoryName ?? "Sin categoría"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Marca</dt>
                    <dd className="mt-1 font-medium text-ink-950">{product.brand ?? "Sin marca"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Precio</dt>
                    <dd className="mt-1 font-display text-xl font-bold text-brand-950">{formatClp(product.salePrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Barcode</dt>
                    <dd className="mt-1 font-medium text-ink-950">{product.barcode ?? "No informado"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Slug público</dt>
                    <dd className="mt-1 break-all font-medium text-ink-950">{product.slug}</dd>
                  </div>
                </dl>
                <div className="mt-5 border-t border-ink-100 pt-5">
                  <h2 className="font-semibold text-ink-950">Descripción</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-600">
                    {product.description ?? "Sin descripción comercial."}
                  </p>
                </div>
                {product.active && product.published ? (
                  <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
                    target="_blank"
                    rel="noreferrer"
                    to={`/productos/${product.slug}`}
                  >
                    Ver en la tienda <ExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Inventario vinculado</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-ink-500">Disponible</dt>
                  <dd className="mt-1 text-2xl font-bold text-ink-950">{product.availableStock}</dd>
                </div>
                <div>
                  <dt className="text-sm text-ink-500">Mínimo</dt>
                  <dd className="mt-1 text-2xl font-bold text-ink-950">{product.minimumStock ?? 0}</dd>
                </div>
              </dl>
              <Alert className="mt-5" tone="info">
                <Warehouse aria-hidden="true" />
                <p>Las existencias son de solo lectura en Productos.</p>
              </Alert>
              <Link
                className={buttonStyles({ className: "mt-4 w-full", variant: "outline" })}
                to={`/app/inventory?productId=${encodeURIComponent(product.id)}`}
              >
                <PackageSearch aria-hidden="true" /> Ver en inventario
              </Link>
            </CardContent>
          </Card>

          {canUpdate ? (
            <Card>
              <CardHeader>
                <CardTitle>Acciones de estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  disabled={!product.active && !product.published}
                  onClick={() => openAction({ kind: "published", product })}
                  variant="outline"
                >
                  <Radio aria-hidden="true" />
                  {product.published ? "Despublicar" : "Publicar"}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => openAction({ kind: "active", product })}
                  variant={product.active ? "danger" : "outline"}
                >
                  <Power aria-hidden="true" />
                  {product.active ? "Desactivar" : "Activar"}
                </Button>
                {!product.active ? (
                  <p className="text-xs leading-5 text-ink-500">
                    Activa el producto antes de publicarlo.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmationDialog
        confirmLabel="Confirmar cambio"
        description={
          action?.kind === "active" && action.product.active
            ? "Desactivar también retirará el producto de la tienda, sin eliminar su historial ni sus movimientos."
            : "Confirma el cambio de estado comercial del producto."
        }
        onConfirm={() => void confirmAction()}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
        open={action !== null}
        pending={pending}
        title={
          action?.kind === "active"
            ? action.product.active
              ? "Desactivar producto"
              : "Activar producto"
            : action?.product.published
              ? "Despublicar producto"
              : "Publicar producto"
        }
        tone={action?.kind === "active" && action.product.active ? "danger" : "primary"}
      />
    </div>
  );
}
