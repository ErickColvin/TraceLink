import { FilterX, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
} from "@/components/ui";
import { useHasPermission } from "@/features/auth";

import { AdminCustomerList } from "../components/admin-customer-list";
import type { CustomerSort, CustomerStatus } from "../domain";
import { useStaffCustomers } from "../queries/customer-queries";

const selectClassName =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60";

function readStatus(value: string): CustomerStatus | "ALL" {
  return value === "ACTIVE" || value === "INACTIVE" ? value : "ALL";
}

function readSort(value: string): CustomerSort {
  if (value === "NAME_ASC" || value === "NAME_DESC") return value;
  return "NEWEST";
}

export function AdminCustomersPage() {
  const canView = useHasPermission("customers.view");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "ALL">("ALL");
  const [sort, setSort] = useState<CustomerSort>("NEWEST");
  const [page, setPage] = useState(1);
  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status === "ALL" ? undefined : status,
      sort,
      page,
      pageSize: 8,
    }),
    [page, search, sort, status],
  );
  const customersQuery = useStaffCustomers(params);
  const hasFilters = Boolean(search.trim()) || status !== "ALL" || sort !== "NEWEST";

  const resetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setSort("NEWEST");
    setPage(1);
  };

  if (!canView) {
    return (
      <ErrorState
        title="No tienes permiso para ver clientes"
        description="Solicita el permiso customers.view a una persona administradora."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relación con clientes"
        title="Clientes"
        description="Consulta datos de contacto, actividad reciente y relaciones operativas sin mezclar este acceso con el perfil privado del cliente."
        actions={
          customersQuery.data ? (
            <Badge tone="info">{customersQuery.data.totalItems} clientes</Badge>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 xl:grid-cols-[minmax(16rem,1.5fr)_1fr_1fr_auto] xl:items-end">
          <div className="sm:col-span-2 xl:col-span-1">
            <Label htmlFor="admin-customer-search">Buscar</Label>
            <div className="relative mt-1.5">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              />
              <Input
                className="pl-9"
                id="admin-customer-search"
                placeholder="Nombre, correo o teléfono"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="admin-customer-status">Estado</Label>
            <select
              className={`${selectClassName} mt-1.5`}
              id="admin-customer-status"
              value={status}
              onChange={(event) => {
                setStatus(readStatus(event.target.value));
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </div>
          <div>
            <Label htmlFor="admin-customer-sort">Orden</Label>
            <select
              className={`${selectClassName} mt-1.5`}
              id="admin-customer-sort"
              value={sort}
              onChange={(event) => {
                setSort(readSort(event.target.value));
                setPage(1);
              }}
            >
              <option value="NEWEST">Más recientes</option>
              <option value="NAME_ASC">Nombre A–Z</option>
              <option value="NAME_DESC">Nombre Z–A</option>
            </select>
          </div>
          <Button disabled={!hasFilters} onClick={resetFilters} variant="ghost">
            <FilterX aria-hidden="true" /> Limpiar
          </Button>
        </CardContent>
      </Card>

      {customersQuery.isPending ? (
        <div aria-label="Cargando clientes" className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <LoadingSkeleton className="h-28 rounded-2xl" key={index} />
          ))}
        </div>
      ) : null}

      {customersQuery.isError ? (
        <ErrorState
          title="No pudimos cargar los clientes"
          description="Reintenta para consultar nuevamente el directorio operativo."
          action={
            <Button onClick={() => void customersQuery.refetch()}>Reintentar</Button>
          }
        />
      ) : null}

      {customersQuery.data?.items.length === 0 ? (
        <EmptyState
          icon={<UsersRound />}
          title="No hay clientes para estos filtros"
          description="Ajusta la búsqueda por nombre, correo o teléfono, o vuelve al directorio completo."
          action={hasFilters ? <Button onClick={resetFilters}>Quitar filtros</Button> : undefined}
        />
      ) : null}

      {customersQuery.data && customersQuery.data.items.length > 0 ? (
        <>
          <AdminCustomerList customers={customersQuery.data.items} />
          <nav
            aria-label="Paginación de clientes"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p aria-live="polite" className="text-sm text-ink-600">
              Página {customersQuery.data.page} de {customersQuery.data.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={customersQuery.data.page <= 1 || customersQuery.isFetching}
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                disabled={
                  customersQuery.data.page >= customersQuery.data.totalPages ||
                  customersQuery.isFetching
                }
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
