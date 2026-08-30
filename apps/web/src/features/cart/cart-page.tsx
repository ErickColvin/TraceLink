import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "@/components";
import { Button, Card, CardContent, buttonStyles } from "@/components/ui";
import { useCart } from "@/features/cart/use-cart";
import { formatClp } from "@/lib/formatters";

export function CartPage() {
  const { items, removeItem, setQuantity, total } = useCart();

  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Tu selección"
          title="Carrito"
          description="Revisa cantidades y precios. El checkout se conectará en la fase de ecommerce."
        />

        {items.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<ShoppingBag />}
            title="Tu carrito está vacío"
            description="Explora el catálogo y agrega productos disponibles."
            action={<Link to="/productos" className={buttonStyles()}>Ver productos</Link>}
          />
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.productId}>
                  <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:pt-6">
                    <img
                      src={item.imageUrl ?? "/assets/ch-market-hero.jpg"}
                      alt=""
                      className="h-28 w-full rounded-xl object-cover sm:w-36"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = "/assets/ch-market-hero.jpg";
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <Link to={`/productos/${item.slug}`} className="font-bold text-ink-950 hover:text-brand-700">
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm text-ink-600">{formatClp(item.unitPrice)} por unidad</p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center rounded-xl border border-ink-200 bg-white">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Disminuir cantidad de ${item.name}`}
                            onClick={() => setQuantity(item.productId, item.quantity - 1)}
                          >
                            <Minus aria-hidden="true" />
                          </Button>
                          <output className="min-w-9 text-center text-sm font-bold" aria-label={`Cantidad: ${item.quantity}`}>
                            {item.quantity}
                          </output>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Aumentar cantidad de ${item.name}`}
                            disabled={item.quantity >= item.availableStock}
                            onClick={() => setQuantity(item.productId, item.quantity + 1)}
                          >
                            <Plus aria-hidden="true" />
                          </Button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.productId)}>
                          <Trash2 aria-hidden="true" /> Eliminar
                        </Button>
                      </div>
                    </div>
                    <p className="font-display text-lg font-bold text-brand-950">
                      {formatClp(item.unitPrice * item.quantity)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="lg:sticky lg:top-28">
              <CardContent className="pt-5 sm:pt-6">
                <h2 className="text-lg font-bold">Resumen</h2>
                <div className="mt-5 flex items-center justify-between border-b border-ink-100 pb-4 text-sm text-ink-600">
                  <span>Productos</span><span>Incluidos</span>
                </div>
                <div className="flex items-center justify-between py-5">
                  <span className="font-semibold">Total estimado</span>
                  <strong className="text-xl text-brand-950">{formatClp(total)}</strong>
                </div>
                <Link className={buttonStyles({ size: "lg", className: "w-full" })} to="/checkout">
                  Continuar al checkout
                </Link>
                <p className="mt-3 text-center text-xs leading-5 text-ink-500">
                  El checkout es visual: el pago y la reserva de stock aún no están habilitados.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
