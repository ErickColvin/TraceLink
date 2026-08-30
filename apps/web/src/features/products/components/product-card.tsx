import { ArrowUpRight, PackageX } from "lucide-react";
import { Link } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { Badge, Card, buttonStyles } from "@/components/ui";
import type { Product } from "@/features/products";
import { formatClp } from "@/lib/formatters";

type ProductCardProps = {
  categoryName?: string;
  product: Product;
};

function getAvailability(product: Product) {
  if (product.availableStock <= 0) {
    return { label: "Sin stock", tone: "neutral" as const };
  }

  if (
    product.minimumStock !== undefined &&
    product.availableStock <= product.minimumStock
  ) {
    return { label: "Últimas unidades", tone: "warning" as const };
  }

  return { label: "Disponible", tone: "success" as const };
}

export function ProductCard({ categoryName, product }: ProductCardProps) {
  const availability = getAvailability(product);

  return (
    <article className="h-full">
      <Card className="group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lifted motion-reduce:transform-none">
        <Link
          to={`/productos/${product.slug}`}
          className="relative block aspect-[4/3] overflow-hidden bg-ice-100"
          aria-label={`Ver ${product.name}`}
        >
          <img
            src={product.imageUrl ?? "/assets/ch-market-hero.jpg"}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/assets/ch-market-hero.jpg";
            }}
          />
          <Badge tone={availability.tone} className="absolute left-3 top-3 bg-white/95 shadow-sm">
            {availability.label}
          </Badge>
        </Link>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-brand-700">
            {categoryName ?? `Selección ${tenantBrand.name}`}
          </p>
          <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-6 text-ink-950">
            <Link to={`/productos/${product.slug}`} className="hover:text-brand-700">
              {product.name}
            </Link>
          </h3>
          {product.brand ? <p className="mt-1 text-sm text-ink-500">{product.brand}</p> : null}
          <div className="mt-auto flex items-end justify-between gap-4 pt-5">
            <div>
              <p className="text-xs text-ink-500">Precio</p>
              <p className="font-display text-xl font-extrabold text-brand-950">
                {formatClp(product.salePrice)}
              </p>
            </div>
            {product.availableStock > 0 ? (
              <Link
                to={`/productos/${product.slug}`}
                className={buttonStyles({ variant: "outline", size: "icon" })}
                aria-label={`Ver detalle de ${product.name}`}
              >
                <ArrowUpRight aria-hidden="true" />
              </Link>
            ) : (
              <span className="grid size-11 place-items-center rounded-xl bg-ink-50 text-ink-400" aria-label="Producto sin stock">
                <PackageX aria-hidden="true" className="size-4" />
              </span>
            )}
          </div>
        </div>
      </Card>
    </article>
  );
}
