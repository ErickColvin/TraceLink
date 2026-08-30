import { ArrowLeft, SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { buttonStyles } from "@/components/ui";

export function NotFoundPage() {
  return (
    <section className="grid min-h-[70vh] place-items-center bg-ice-50 px-4 py-16 text-center">
      <div>
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <SearchX aria-hidden="true" className="size-8" />
        </span>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-brand-700">Error 404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-950 sm:text-4xl">No encontramos esta página</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-ink-600">El enlace puede haber cambiado o la sección todavía no está disponible.</p>
        <Link to="/" className={buttonStyles({ className: "mt-7" })}>
          <ArrowLeft aria-hidden="true" /> Volver al inicio
        </Link>
      </div>
    </section>
  );
}
