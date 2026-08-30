import { ArrowRight, PackageSearch, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Button, Card, CardContent, Input, Label } from "@/components/ui";
import { useCurrentCustomerPackages } from "@/features/packages";
import { getPackageStatusMeta } from "@/features/packages/presentation/package-status";
import { formatDate } from "@/lib/formatters";

export function CustomerPackagesPage() {
  const [search, setSearch] = useState("");
  const packagesQuery = useCurrentCustomerPackages({ search: search.trim() || undefined, pageSize: 24, sort: "NEWEST" });

  return (
    <div>
      <PageHeader eyebrow="Trazabilidad" title="Mis paquetes" description="Sigue cada paquete asociado a tu cuenta y revisa su último evento registrado." />
      <div className="mt-6 max-w-md"><Label htmlFor="package-search">Buscar por código o contenido</Label><div className="relative"><Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" /><Input id="package-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" placeholder="Ej. CHM-41028" /></div></div>
      <div className="mt-7">
        {packagesQuery.isPending ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <LoadingSkeleton key={index} className="h-52 rounded-2xl" />)}</div> : null}
        {packagesQuery.isError ? <ErrorState title="No pudimos cargar tus paquetes" action={<Button onClick={() => void packagesQuery.refetch()}>Reintentar</Button>} /> : null}
        {packagesQuery.data?.items.length === 0 ? <EmptyState icon={<PackageSearch />} title="No encontramos paquetes" description={search ? "Prueba con otro código o limpia la búsqueda." : "Los paquetes asociados a tu cuenta aparecerán aquí."} action={search ? <Button onClick={() => setSearch("")}>Limpiar búsqueda</Button> : undefined} /> : null}
        {packagesQuery.data && packagesQuery.data.items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {packagesQuery.data.items.map((item) => { const meta = getPackageStatusMeta(item.status); const lastEvent = item.events.at(-1); return (
              <Card key={item.id} className="overflow-hidden"><CardContent className="pt-5 sm:pt-6"><div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><PackageSearch aria-hidden="true" className="size-5" /></span><Badge tone={meta.tone}>{meta.shortLabel}</Badge></div><h2 className="mt-5 font-display text-lg font-bold">{item.trackingCode}</h2><p className="mt-1 text-sm text-ink-600">{item.contents.description} · {item.contents.itemCount} artículos</p>{lastEvent ? <div className="mt-5 rounded-xl bg-ice-50 p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">Último evento</p><p className="mt-1 text-sm text-ink-700">{lastEvent.description}</p><p className="mt-2 text-xs text-ink-500">{formatDate(lastEvent.occurredAt)}</p></div> : null}<Link to={`/mi-cuenta/paquetes/${item.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-900">Ver trazabilidad <ArrowRight aria-hidden="true" className="size-4" /></Link></CardContent></Card>
            ); })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

