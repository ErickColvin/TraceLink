import { ArrowRight, CheckCircle2, Clock3, PackageSearch, ShoppingBasket, Snowflake, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { EmptyState, ErrorState, LoadingSkeleton, SectionHeading } from "@/components";
import { Badge, Button, Card, CardContent, buttonStyles } from "@/components/ui";
import { ProductCard } from "@/features/products/components/product-card";
import { ProductGridSkeleton } from "@/features/products/components/product-grid-skeleton";
import { useProductCategories, useProducts } from "@/features/products";

const benefits = [
  { icon: ShoppingBasket, title: "Compra simple", description: "Productos, precios y disponibilidad sin pasos innecesarios." },
  { icon: Snowflake, title: "Selección disponible", description: "Congelados y esenciales elegidos para tu día a día." },
  { icon: PackageSearch, title: "Seguimiento claro", description: "Consulta el avance de tus pedidos y paquetes en tu cuenta." },
  { icon: Clock3, title: "Retiro coordinado", description: "Estados visibles para saber cuándo tu compra está lista." },
] as const;

export function HomePage() {
  const featuredQuery = useProducts({ featured: true, pageSize: 4, sort: "FEATURED" });
  const categoriesQuery = useProductCategories();
  const categoriesById = new Map(categoriesQuery.data?.map((category) => [category.id, category.name]) ?? []);

  return (
    <>
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(78,174,209,0.22),transparent_34%),radial-gradient(circle_at_88%_80%,rgba(238,117,32,0.18),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-24">
          <div className="z-10">
            <Badge tone="info" className="border border-white/15 bg-white/10 text-ice-100 ring-0">
              <Sparkles aria-hidden="true" className="mr-1.5 size-3.5" /> Una forma más clara de comprar
            </Badge>
            <h1 className="mt-6 max-w-2xl text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Tu compra lista. Tu seguimiento también.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ice-200">
              Descubre productos congelados y esenciales en {tenantBrand.name}, con disponibilidad visible y una cuenta que mantiene tus pedidos en orden.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/productos" className={buttonStyles({ size: "lg", className: "bg-coral-500 hover:bg-coral-600" })}>
                Ver productos <ArrowRight aria-hidden="true" />
              </Link>
              <Link to="/login?returnTo=/mi-cuenta/pedidos" className={buttonStyles({ variant: "outline", size: "lg", className: "border-white/30 bg-white/5 text-white hover:border-white/60 hover:bg-white/10" })}>
                Ver mis pedidos
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ice-200">
              <span className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="size-4 text-coral-300" /> Precios en {tenantBrand.currency}</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="size-4 text-coral-300" /> Datos demo realistas</span>
            </div>
          </div>
          <div className="relative min-h-80 overflow-hidden rounded-[2rem] border border-white/15 shadow-lifted sm:min-h-[440px]">
            <img src="/assets/ch-market-hero.jpg" alt="Salmón, camarones y pescado congelado presentados sobre hielo" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-950/60 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl border border-white/20 bg-brand-950/80 p-4 backdrop-blur sm:p-5">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ice-300">Selección de la semana</p><p className="mt-1 font-bold">Productos del mar y congelados</p></div>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-coral-500"><Snowflake aria-hidden="true" className="size-5" /></span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Explora por categoría" title="Todo parte por una buena selección" description="Categorías claras para llegar más rápido a lo que buscas." />
        {categoriesQuery.isPending ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <LoadingSkeleton key={index} className="h-64 rounded-2xl" />)}</div>
        ) : categoriesQuery.isError ? (
          <ErrorState className="mt-8" title="No pudimos cargar las categorías" action={<Button onClick={() => void categoriesQuery.refetch()}>Reintentar</Button>} />
        ) : categoriesQuery.data && categoriesQuery.data.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categoriesQuery.data.map((category) => (
              <Link key={category.id} to={`/productos?categoria=${category.id}`} className="group relative min-h-64 overflow-hidden rounded-2xl bg-brand-950 shadow-card">
                <img
                  src={category.imageUrl ?? "/assets/ch-market-hero.jpg"}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105 motion-reduce:transform-none"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/assets/ch-market-hero.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white"><h3 className="text-xl font-bold">{category.name}</h3><p className="mt-2 text-sm leading-5 text-ice-100">{category.description}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-coral-300">Explorar <ArrowRight aria-hidden="true" className="size-4" /></span></div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState className="mt-8" title="Aún no hay categorías publicadas" description={`Vuelve pronto para explorar la selección de ${tenantBrand.name}.`} />
        )}
      </section>

      <section className="bg-ice-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={`Favoritos de ${tenantBrand.name}`}
            title="Productos destacados"
            description="Una selección práctica con disponibilidad visible."
            actions={<Link to="/productos" className={buttonStyles({ variant: "outline" })}>Ver catálogo <ArrowRight aria-hidden="true" /></Link>}
          />
          <div className="mt-8">
            {featuredQuery.isPending ? (
              <ProductGridSkeleton />
            ) : featuredQuery.isError ? (
              <ErrorState title="No pudimos cargar los destacados" action={<Button onClick={() => void featuredQuery.refetch()}>Reintentar</Button>} />
            ) : featuredQuery.data.items.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featuredQuery.data.items.map((product) => <ProductCard key={product.id} product={product} categoryName={categoriesById.get(product.categoryId)} />)}
              </div>
            ) : (
              <EmptyState title="Aún no hay productos destacados" description="Puedes revisar el catálogo completo mientras preparamos nuevas recomendaciones." action={<Link to="/productos" className={buttonStyles({ variant: "outline" })}>Ver catálogo</Link>} />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading align="center" eyebrow="Hecho para darte tranquilidad" title="Menos incertidumbre, más control" />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ description, icon: Icon, title }) => (
            <Card key={title} className="border-0 bg-brand-50 shadow-none">
              <CardContent className="pt-6"><span className="grid size-11 place-items-center rounded-xl bg-white text-brand-700 shadow-sm"><Icon aria-hidden="true" className="size-5" /></span><h3 className="mt-5 font-bold text-ink-950">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-600">{description}</p></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 overflow-hidden rounded-3xl bg-brand-950 px-6 py-10 text-white shadow-lifted sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-14 lg:py-14">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-300">Tu cuenta {tenantBrand.name}</p><h2 className="mt-3 max-w-2xl font-display text-3xl font-bold">Tus pedidos y paquetes, reunidos en un solo lugar.</h2><p className="mt-3 max-w-2xl text-ice-200">Ingresa para revisar estados privados sin búsquedas por nombre ni datos expuestos.</p></div>
          <Link to="/login" className={buttonStyles({ size: "lg", className: "bg-white text-brand-950 hover:bg-ice-100" })}>Ingresar a mi cuenta <ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
