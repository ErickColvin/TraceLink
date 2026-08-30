import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui";

export type AdminProductPaginationProps = Readonly<{
  disabled?: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange(page: number): void;
}>;

function getVisiblePages(page: number, totalPages: number): number[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);
}

export function AdminProductPagination({
  disabled = false,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: AdminProductPaginationProps) {
  if (totalItems === 0) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <nav
      aria-label="PaginaciÃ³n de productos"
      className="flex flex-col gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-ink-600">
        Mostrando {firstItem}â€“{lastItem} de {totalItems}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          aria-label="Ir a la pÃ¡gina anterior"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="sm"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        {visiblePages.map((candidate, index) => {
          const previous = visiblePages[index - 1];
          const showGap = previous !== undefined && candidate - previous > 1;
          return (
            <span className="contents" key={candidate}>
              {showGap ? (
                <span aria-hidden="true" className="px-1 text-ink-400">
                  â€¦
                </span>
              ) : null}
              <Button
                aria-current={candidate === page ? "page" : undefined}
                aria-label={`Ir a la pÃ¡gina ${candidate}`}
                disabled={disabled}
                onClick={() => onPageChange(candidate)}
                size="sm"
                variant={candidate === page ? "primary" : "ghost"}
              >
                {candidate}
              </Button>
            </span>
          );
        })}
        <Button
          aria-label="Ir a la pÃ¡gina siguiente"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          variant="outline"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
