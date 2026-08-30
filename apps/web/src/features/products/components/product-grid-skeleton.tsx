import { LoadingSkeleton } from "@/components";

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Cargando productos">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-ink-100 bg-white p-4">
          <LoadingSkeleton className="aspect-[4/3] w-full rounded-xl" />
          <LoadingSkeleton className="mt-5 h-3 w-24" />
          <LoadingSkeleton className="mt-3 h-6 w-full" />
          <LoadingSkeleton className="mt-2 h-4 w-2/3" />
          <LoadingSkeleton className="mt-6 h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

