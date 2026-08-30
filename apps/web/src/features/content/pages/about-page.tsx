import { ArrowRight, HeartHandshake, PackageCheck, Snowflake } from "lucide-react";
import { Link } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { SectionHeading } from "@/components";
import { Card, CardContent, CardHeader, CardTitle, buttonStyles } from "@/components/ui";

const commitments = [
  {
    icon: Snowflake,
    title: "Selección que simplifica",
    description: "Un catálogo concreto, con disponibilidad visible y precios en pesos chilenos.",
  },
  {
    icon: PackageCheck,
    title: "Información a tiempo",
    description: "Pedidos y paquetes con estados claros, desde la recepción hasta el retiro.",
  },
  {
    icon: HeartHandshake,
    title: "Atención cercana",
    description: "Tecnología al servicio de una experiencia de barrio simple y confiable.",
  },
] as const;

export function AboutPage() {
  return (
    <>
      <section className="overflow-hidden bg-brand-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-300">Nosotros</p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Una compra cotidiana con información extraordinariamente clara.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ice-200">
              {tenantBrand.name} combina productos congelados seleccionados con una experiencia digital diseñada para ahorrar tiempo y evitar dudas.
            </p>
          </div>
          <div className="surface-grid rounded-3xl border border-white/15 bg-white p-8 text-ink-950 shadow-lifted">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Nuestra dirección</p>
            <p className="mt-4 text-2xl font-bold">Simple de comprar. Fácil de seguir.</p>
            <p className="mt-3 leading-7 text-ink-600">
              Esta primera experiencia de TraceLink para {tenantBrand.name} conecta vitrina, cuenta de cliente y operación en una misma base preparada para crecer.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Cómo trabajamos"
          title="Confianza visible en cada paso"
          description="El diseño prioriza información útil, decisiones rápidas y estados que se entienden sin conocer sistemas internos."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {commitments.map(({ description, icon: Icon, title }) => (
            <Card key={title} className="h-full">
              <CardHeader>
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <CardTitle className="pt-3">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-ink-600">{description}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-ice-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink-950">¿Quieres conocer la selección?</h2>
            <p className="mt-2 text-ink-600">Explora productos con precio y disponibilidad visibles.</p>
          </div>
          <Link to="/productos" className={buttonStyles({ size: "lg" })}>
            Ver productos <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
