import { useState } from "react";
import { ArrowLeft, Check, CircleAlert, Minus, Plus, ShoppingBag, Snowflake } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { EmptyState, ErrorState, LoadingSkeleton, SectionHeading } from "@/components";
import { Alert, Badge, Button, buttonStyles } from "@/components/ui";
import { useCart } from "@/features/cart/use-cart";
import { ProductCard } from "@/features/products/components/product-card";
import { useProductBySlug, useProductCategories, useRelatedProducts } from "@/features/products";
import { formatClp } from "@/lib/formatters";

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  return <ProductDetailContent key={slug ?? "missing-product"} slug={slug} />;
}

function ProductDetailContent({ slug }: { slug?: string }) {
  const productQuery = useProductBySlug(slug);
  const relatedQuery = useRelatedProducts(slug, 4);
  const categoriesQuery = useProductCategories();
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");

  if (productQuery.isPending) {
    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
        <LoadingSkeleton className="aspect-square rounded-3xl" />
        <div className="space-y-4 pt-4"><LoadingSkeleton className="h-4 w-28" /><LoadingSkeleton className="h-12 w-full" /><LoadingSkeleton className="h-6 w-40" /><LoadingSkeleton className="h-28 w-full" /></div>
      </div>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <ErrorState
          title="No encontramos este producto"
          description="Puede que ya no esté publicado o que el enlace sea incorrecto."
          action={<Link to="/productos" className={buttonStyles()}><ArrowLeft aria-hidden="true" /> Volver al catálogo</Link>}
        />
      </div>
    );
  }

  const product = productQuery.data;
  const category = categoriesQuery.data?.find((item) => item.id === product.categoryId);
  const categoryNames = new Map(
    categoriesQuery.data?.map((item) => [item.id, item.name] as const) ?? [],
  );
  const isAvailable = product.availableStock > 0;
  const cartQuantity = items.find((item) => item.productId === product.id)?.quantity ?? 0;
  const remainingStock = Math.max(0, product.availableStock - cartQuantity);

  const addToCart = () => {
    const addedQuantity = Math.min(quantity, remainingStock);
    if (addedQuantity <= 0) return;

    addItem(product, addedQuantity);
    setQuantity(Math.max(1, Math.min(quantity, remainingStock - addedQuantity)));
    setFeedback(`${addedQuantity} ${addedQuantity === 1 ? "unidad agregada" : "unidades agregadas"} al carrito.`);
  };

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link to="/productos" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-brand-700">
          <ArrowLeft aria-hidden="true" className="size-4" /> Volver a productos
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="overflow-hidden rounded-3xl bg-ice-100 shadow-card">
            <img
              src={product.imageUrl ?? "/assets/ch-market-hero.jpg"}
              alt={product.name}
              className="aspect-square h-full w-full object-cover"
              onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/assets/ch-market-hero.jpg"; }}
            />
          </div>

          <div className="self-center">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{category?.name ?? tenantBrand.name}</Badge>
              <Badge tone={isAvailable ? "success" : "neutral"}>{isAvailable ? "Disponible" : "Sin stock"}</Badge>
            </div>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-ink-950 sm:text-4xl lg:text-5xl">
              {product.name}
            </h1>
            {product.brand ? <p className="mt-3 text-base text-ink-500">Por {product.brand}</p> : null}
            <p className="mt-6 font-display text-3xl font-extrabold text-brand-950">{formatClp(product.salePrice)}</p>
            <p className="mt-6 text-base leading-7 text-ink-600">{product.description}</p>

            <div className="mt-7 rounded-2xl border border-brand-100 bg-brand-50 p-4">
              <div className="flex gap-3">
                <Snowflake aria-hidden="true" className="mt-0.5 size-5 text-brand-700" />
                <div><p className="font-semibold text-ink-950">Disponibilidad visible</p><p className="mt-1 text-sm text-ink-600">{isAvailable ? `${remainingStock} unidades disponibles para agregar${cartQuantity > 0 ? ` · ${cartQuantity} en tu carrito` : ""}.` : "Este producto no se puede agregar por ahora."}</p></div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <div className="inline-flex items-center justify-between rounded-xl border border-ink-200 bg-white sm:w-36">
                <Button variant="ghost" size="icon" aria-label="Disminuir cantidad" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus aria-hidden="true" /></Button>
                <output className="min-w-8 text-center font-bold" aria-label={`Cantidad: ${quantity}`}>{quantity}</output>
                <Button variant="ghost" size="icon" aria-label="Aumentar cantidad" disabled={!isAvailable || remainingStock === 0 || quantity >= remainingStock} onClick={() => setQuantity((current) => Math.min(remainingStock, current + 1))}><Plus aria-hidden="true" /></Button>
              </div>
              <Button className="flex-1" size="lg" disabled={!isAvailable || remainingStock === 0} onClick={addToCart}>
                <ShoppingBag aria-hidden="true" /> {!isAvailable ? "Sin stock" : remainingStock === 0 ? "Máximo en el carrito" : "Agregar al carrito"}
              </Button>
            </div>
            <div aria-live="polite" className="mt-4 min-h-12">
              {feedback ? <Alert tone="success" role="status"><Check aria-hidden="true" /><p>{feedback}</p></Alert> : null}
            </div>
            <p className="mt-2 text-xs text-ink-500">SKU: {product.sku}{product.barcode ? ` · Código: ${product.barcode}` : ""}</p>
          </div>
        </div>
      </div>

      <section className="border-t border-ink-100 bg-ice-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="También te puede interesar" title="Productos relacionados" />
          {relatedQuery.isError ? (
            <Alert tone="warning" className="mt-7">
              <CircleAlert aria-hidden="true" />
              <p>No pudimos cargar las recomendaciones. El producto principal sigue disponible.</p>
            </Alert>
          ) : relatedQuery.data && relatedQuery.data.length > 0 ? (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {relatedQuery.data.map((related) => (
                <ProductCard
                  key={related.id}
                  product={related}
                  categoryName={categoryNames.get(related.categoryId)}
                />
              ))}
            </div>
          ) : relatedQuery.isPending ? (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <LoadingSkeleton key={index} className="aspect-[3/4] rounded-2xl" />)}</div>
          ) : (
            <EmptyState className="mt-7" title="Sin recomendaciones por ahora" description="Explora el catálogo completo para descubrir más productos." action={<Link to="/productos" className={buttonStyles({ variant: "outline" })}>Ver catálogo</Link>} />
          )}
        </div>
      </section>
    </div>
  );
}
