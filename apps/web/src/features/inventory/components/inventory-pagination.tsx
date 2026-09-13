import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui";

export interface InventoryPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function InventoryPagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: InventoryPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginación de inventario"
      className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-4 sm:flex-row"
    >
      <p className="text-sm text-ink-600">
        Página <strong>{page}</strong> de <strong>{totalPages}</strong> ·{" "}
        {totalItems} registros
      </p>
      <div className="flex gap-2">
        <Button
          aria-label="Ir a la página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="sm"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Anterior
        </Button>
        <Button
          aria-label="Ir a la página siguiente"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          variant="outline"
        >
          Siguiente
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
