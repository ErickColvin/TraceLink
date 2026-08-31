import { Eye, Pencil, Power, Radio, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";

import { Button, Card, CardContent, buttonStyles } from "@/components/ui";
import { formatClp } from "@/lib/formatters";

import type { Product } from "../domain";
import { ProductStatusBadges } from "./product-status-badges";

export type AdminProductListProps = Readonly<{
  categoriesById: ReadonlyMap<string, string>;
  canUpdate: boolean;
  products: readonly Product[];
  pendingProductId?: string;
  onRequestActiveChange(product: Product): void;
  onRequestPublishedChange(product: Product): void;
}>;

function ProductImage({ product }: Readonly<{ product: Product }>) {
  return (
    <img
      alt=""
      className="size-14 shrink-0 rounded-xl bg-ice-100 object-cover"
      src={product.imageUrl ?? "/assets/ch-market-hero.jpg"}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = "/assets/ch-market-hero.jpg";
      }}
    />
  );
}

function ProductActions({
  canUpdate,
  pending,
  product,
  onRequestActiveChange,
  onRequestPublishedChange,
}: Readonly<{
  canUpdate: boolean;
  pending: boolean;
  product: Product;
  onRequestActiveChange(product: Product): void;
  onRequestPublishedChange(product: Product): void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        aria-label={`Ver detalle de ${product.name}`}
        className={buttonStyles({ size: "sm", variant: "ghost" })}
        to={`/app/products/${product.id}`}
      >
        <Eye aria-hidden="true" />
        <span className="sm:hidden">Ver</span>
      </Link>
      {canUpdate ? (
        <>
          <Link
            aria-label={`Editar ${product.name}`}
            className={buttonStyles({ size: "sm", variant: "ghost" })}
            to={`/app/products/${product.id}/edit`}
          >
            <Pencil aria-hidden="true" />
            <span className="sm:hidden">Editar</span>
          </Link>
          <Button
            aria-label={`${product.published ? "Despublicar" : "Publicar"} ${product.name}`}
            disabled={pending || (!product.active && !product.published)}
            onClick={() => onRequestPublishedChange(product)}
            size="sm"
            variant="ghost"
          >
            <Radio aria-hidden="true" />
            <span className="sm:hidden">
              {product.published ? "Despublicar" : "Publicar"}
            </span>
          </Button>
          <Button
            aria-label={`${product.active ? "Desactivar" : "Activar"} ${product.name}`}
            disabled={pending}
            onClick={() => onRequestActiveChange(product)}
            size="sm"
            variant={product.active ? "ghost" : "outline"}
          >
            <Power aria-hidden="true" />
            <span className="sm:hidden">
              {product.active ? "Desactivar" : "Activar"}
            </span>
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function AdminProductList({
  categoriesById,
  canUpdate,
  products,
  pendingProductId,
  onRequestActiveChange,
  onRequestPublishedChange,
}: AdminProductListProps) {
  return (
    <>
      <div className="space-y-3 xl:hidden">
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="pt-5 sm:pt-6">
              <div className="flex items-start gap-4">
                <ProductImage product={product} />
                <div className="min-w-0 flex-1">
                  <Link
                    className="font-semibold text-ink-950 hover:text-brand-700"
                    to={`/app/products/${product.id}`}
                  >
                    {product.name}
                  </Link>
                  <p className="mt-1 text-xs font-medium text-ink-500">
                    {product.sku}
                  </p>
                  <ProductStatusBadges product={product} />
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-ink-500">Categoría</dt>
                  <dd className="font-medium text-ink-900">
                    {categoriesById.get(product.categoryId) ?? "Sin categoría"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Marca</dt>
                  <dd className="font-medium text-ink-900">
                    {product.brand ?? "Sin marca"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Precio</dt>
                  <dd className="font-semibold text-ink-950">
                    {formatClp(product.salePrice)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-500">Disponible</dt>
                  <dd className="inline-flex items-center gap-1.5 font-semibold text-ink-950">
                    <Warehouse aria-hidden="true" className="size-4 text-brand-700" />
                    {product.availableStock}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-ink-100 pt-3">
                <ProductActions
                  canUpdate={canUpdate}
                  pending={pendingProductId === product.id}
                  product={product}
                  onRequestActiveChange={onRequestActiveChange}
                  onRequestPublishedChange={onRequestPublishedChange}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card xl:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">
            Productos administrables y sus estados comerciales
          </caption>
          <thead className="bg-ice-50 text-xs font-semibold uppercase tracking-wide text-ink-600">
            <tr>
              <th className="w-[27%] px-4 py-3" scope="col">Producto</th>
              <th className="w-[12%] px-3 py-3" scope="col">SKU</th>
              <th className="w-[14%] px-3 py-3" scope="col">Categoría / marca</th>
              <th className="w-[11%] px-3 py-3" scope="col">Precio</th>
              <th className="w-[8%] px-3 py-3" scope="col">Stock</th>
              <th className="w-[16%] px-3 py-3" scope="col">Estado</th>
              <th className="w-[12%] px-3 py-3 text-right" scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {products.map((product) => (
              <tr className="align-middle" key={product.id}>
                <th className="px-4 py-3 font-normal" scope="row">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductImage product={product} />
                    <Link
                      className="line-clamp-2 font-semibold text-ink-950 hover:text-brand-700"
                      to={`/app/products/${product.id}`}
                    >
                      {product.name}
                    </Link>
                  </div>
                </th>
                <td className="break-words px-3 py-3 font-medium text-ink-700">
                  {product.sku}
                </td>
                <td className="px-3 py-3 text-ink-700">
                  <span className="line-clamp-1 font-medium">
                    {categoriesById.get(product.categoryId) ?? "Sin categoría"}
                  </span>
                  <span className="line-clamp-1 text-xs text-ink-500">
                    {product.brand ?? "Sin marca"}
                  </span>
                </td>
                <td className="px-3 py-3 font-semibold text-ink-950">
                  {formatClp(product.salePrice)}
                </td>
                <td className="px-3 py-3 font-semibold text-ink-950">
                  {product.availableStock}
                </td>
                <td className="px-3 py-3">
                  <ProductStatusBadges product={product} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end">
                    <ProductActions
                      canUpdate={canUpdate}
                      pending={pendingProductId === product.id}
                      product={product}
                      onRequestActiveChange={onRequestActiveChange}
                      onRequestPublishedChange={onRequestPublishedChange}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
