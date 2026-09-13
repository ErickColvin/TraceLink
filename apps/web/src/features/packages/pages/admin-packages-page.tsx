import { PackageSearch, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "../../../components";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  buttonStyles,
} from "../../../components/ui";
import { useHasPermission } from "../../auth";
import {
  PACKAGE_CARRIERS,
  PACKAGE_STATUSES,
  type PackageStatus,
  type StaffPackage,
  type StaffPackageSort,
} from "../domain";
import { getPackageStatusMeta } from "../presentation/package-status";
import { getPackageStorageDuration } from "../presentation/package-storage-duration";
import { useStaffPackages } from "../queries/staff-package-queries";
import { formatDateTime } from "../../../lib/formatters";

const selectStyles =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60";

type ColdStorageFilter = "ALL" | "REQUIRED" | "NOT_REQUIRED";

function readStatus(value: string | null): PackageStatus | "ALL" {
  return PACKAGE_STATUSES.find((status) => status === value) ?? "ALL";
}

function PackageMobileCard({ item }: Readonly<{ item: StaffPackage }>) {
  const meta = getPackageStatusMeta(item.status);
  const storageDuration = getPackageStorageDuration(item);

  return (
    <Card>
      <CardContent className="space-y-4 pt-5 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-950">
              {item.trackingCode}
            </p>
            <p className="mt-1 text-sm text-ink-600">{item.customer.fullName}</p>
          </div>
          <Badge tone={meta.tone}>{meta.shortLabel}</Badge>
        </div>
        <p className="text-sm text-ink-700">
          {item.contents.description} · {item.contents.itemCount} artículos
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-500">Recepción</dt>
            <dd className="mt-1 font-semibold text-ink-800">
              {item.receivedAt ? formatDateTime(item.receivedAt) : "Pendiente"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Conservación</dt>
            <dd className="mt-1 font-semibold text-ink-800">
              {item.contents.requiresColdStorage ? "Cadena de frío" : "Ambiente"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Carrier</dt>
            <dd className="mt-1 font-semibold text-ink-800">{item.carrier}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Días almacenado</dt>
            <dd className="mt-1 font-semibold text-ink-800">
              {storageDuration?.days ?? "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-ink-500">Ubicación</dt>
            <dd className="mt-1 font-semibold text-ink-800">
              {item.storageLocation ?? "Sin ubicación"}
            </dd>
          </div>
        </dl>
        <Link
          to={`/app/packages/${item.id}`}
          className={buttonStyles({ className: "w-full", variant: "outline" })}
        >
          Ver trazabilidad
        </Link>
      </CardContent>
    </Card>
  );
}

export function AdminPackagesPage() {
  const canView = useHasPermission("packages.view");
  const canReceive = useHasPermission("packages.receive");
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [tracking, setTracking] = useState(
    () => searchParams.get("tracking") ?? "",
  );
  const [customer, setCustomer] = useState(
    () => searchParams.get("customer") ?? "",
  );
  const [carrier, setCarrier] = useState(
    () => searchParams.get("carrier") ?? "",
  );
  const [location, setLocation] = useState(
    () => searchParams.get("location") ?? "",
  );
  const [status, setStatus] = useState<PackageStatus | "ALL">(() =>
    readStatus(searchParams.get("status")),
  );
  const [coldStorage, setColdStorage] = useState<ColdStorageFilter>("ALL");
  const [sort, setSort] = useState<StaffPackageSort>("QUEUE");
  const [page, setPage] = useState(1);
  const params = useMemo(
    () => ({
      search,
      tracking,
      customer,
      carrier,
      location,
      statuses: status === "ALL" ? undefined : [status],
      coldStorage:
        coldStorage === "ALL" ? undefined : coldStorage === "REQUIRED",
      sort,
      page,
      pageSize: 8,
    }),
    [carrier, coldStorage, customer, location, page, search, sort, status, tracking],
  );
  const packagesQuery = useStaffPackages(params);

  const resetFilters = () => {
    setSearch("");
    setTracking("");
    setCustomer("");
    setCarrier("");
    setLocation("");
    setStatus("ALL");
    setColdStorage("ALL");
    setSort("QUEUE");
    setPage(1);
  };

  if (!canView) {
    return (
      <ErrorState
        title="No tienes permiso para ver paquetes"
        description="Solicita el permiso packages.view a una persona administradora."
      />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Trazabilidad operativa"
        title="Paquetes"
        description="Gestiona recepción, almacenamiento, excepciones y retiro con un evento por cambio."
        actions={
          canReceive ? (
            <Link to="/app/packages/new" className={buttonStyles()}>
              <Plus aria-hidden="true" />
              Recibir paquete
            </Link>
          ) : undefined
        }
      />

      <Card className="mt-6">
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 xl:grid-cols-4">
          <div>
            <Label htmlFor="staff-package-search">Búsqueda general</Label>
            <div className="relative mt-1.5">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              />
              <Input
                id="staff-package-search"
                value={search}
                className="pl-9"
                placeholder="Código, cliente o contenido"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="staff-package-tracking">Tracking</Label>
            <Input
              id="staff-package-tracking"
              className="mt-1.5"
              value={tracking}
              placeholder="Ej.: CHM-41028"
              onChange={(event) => {
                setTracking(event.currentTarget.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <Label htmlFor="staff-package-customer">Cliente</Label>
            <Input
              id="staff-package-customer"
              className="mt-1.5"
              value={customer}
              placeholder="Nombre o correo"
              onChange={(event) => {
                setCustomer(event.currentTarget.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <Label htmlFor="staff-package-carrier">Carrier</Label>
            <select
              id="staff-package-carrier"
              className={`${selectStyles} mt-1.5`}
              value={carrier}
              onChange={(event) => {
                setCarrier(event.currentTarget.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {PACKAGE_CARRIERS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="staff-package-location">Ubicación</Label>
            <Input
              id="staff-package-location"
              className="mt-1.5"
              value={location}
              placeholder="Bodega, cámara o módulo"
              onChange={(event) => {
                setLocation(event.currentTarget.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <Label htmlFor="staff-package-status">Estado</Label>
            <select
              id="staff-package-status"
              className={`${selectStyles} mt-1.5`}
              value={status}
              onChange={(event) => {
                setStatus(readStatus(event.target.value));
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              {PACKAGE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {getPackageStatusMeta(option).label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="staff-package-cold">Conservación</Label>
            <select
              id="staff-package-cold"
              className={`${selectStyles} mt-1.5`}
              value={coldStorage}
              onChange={(event) => {
                const next = (["ALL", "REQUIRED", "NOT_REQUIRED"] as const).find(
                  (option) => option === event.target.value,
                );
                setColdStorage(next ?? "ALL");
                setPage(1);
              }}
            >
              <option value="ALL">Todas</option>
              <option value="REQUIRED">Requiere frío</option>
              <option value="NOT_REQUIRED">No requiere frío</option>
            </select>
          </div>
          <div>
            <Label htmlFor="staff-package-sort">Orden</Label>
            <select
              id="staff-package-sort"
              className={`${selectStyles} mt-1.5`}
              value={sort}
              onChange={(event) => {
                const next = (["QUEUE", "NEWEST", "OLDEST", "STATUS"] as const).find(
                  (option) => option === event.target.value,
                );
                setSort(next ?? "QUEUE");
                setPage(1);
              }}
            >
              <option value="QUEUE">Prioridad operativa</option>
              <option value="NEWEST">Más recientes</option>
              <option value="OLDEST">Más antiguos</option>
              <option value="STATUS">Estado</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {packagesQuery.isPending ? (
          <div className="space-y-3" aria-label="Cargando paquetes">
            {Array.from({ length: 5 }, (_, index) => (
              <LoadingSkeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : null}
        {packagesQuery.isError ? (
          <ErrorState
            title="No pudimos cargar los paquetes"
            description="Reintenta para consultar nuevamente la cola operativa."
            action={
              <Button onClick={() => void packagesQuery.refetch()}>Reintentar</Button>
            }
          />
        ) : null}
        {packagesQuery.data?.items.length === 0 ? (
          <EmptyState
            icon={<PackageSearch />}
            title="No hay paquetes para estos filtros"
            description="Ajusta la búsqueda o restablece los filtros."
            action={<Button onClick={resetFilters}>Limpiar filtros</Button>}
          />
        ) : null}

        {packagesQuery.data && packagesQuery.data.items.length > 0 ? (
          <>
            <div className="space-y-3 lg:hidden">
              {packagesQuery.data.items.map((item) => (
                <PackageMobileCard key={item.id} item={item} />
              ))}
            </div>

            <div data-allow-horizontal-overflow="true" className="hidden overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card lg:block">
              <table className="min-w-full divide-y divide-ink-100 text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-600">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold">Paquete</th>
                    <th scope="col" className="px-4 py-3 font-bold">Carrier</th>
                    <th scope="col" className="px-4 py-3 font-bold">Cliente</th>
                    <th scope="col" className="px-4 py-3 font-bold">Recepción</th>
                    <th scope="col" className="px-4 py-3 font-bold">Ubicación</th>
                    <th scope="col" className="px-4 py-3 font-bold">Estado</th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">Días almacenado</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {packagesQuery.data.items.map((item) => {
                    const meta = getPackageStatusMeta(item.status);
                    const storageDuration = getPackageStorageDuration(item);
                    return (
                      <tr key={item.id} className="align-middle hover:bg-ice-50/70">
                        <td className="px-4 py-4">
                          <p className="whitespace-nowrap font-bold text-ink-950">
                            {item.trackingCode}
                          </p>
                          <p className="mt-1 max-w-56 truncate text-xs text-ink-500">
                            {item.contents.description}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-ink-700">
                          {item.carrier}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-ink-800">{item.customer.fullName}</p>
                          <p className="mt-1 text-xs text-ink-500">{item.customer.email}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-ink-600">
                          {item.receivedAt ? formatDateTime(item.receivedAt) : "Pendiente"}
                        </td>
                        <td className="max-w-56 px-4 py-4 text-ink-700">
                          {item.storageLocation ?? "Sin ubicación"}
                        </td>
                        <td className="px-4 py-4"><Badge tone={meta.tone}>{meta.shortLabel}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-ink-700">
                          {storageDuration?.days ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            to={`/app/packages/${item.id}`}
                            className={buttonStyles({ size: "sm", variant: "outline" })}
                            aria-label={`Ver trazabilidad de ${item.trackingCode}`}
                          >
                            Ver
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Paginación de paquetes">
              <p className="text-sm text-ink-600">
                Página {packagesQuery.data.page} de {packagesQuery.data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || packagesQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={page >= packagesQuery.data.totalPages || packagesQuery.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </nav>
          </>
        ) : null}
      </div>
    </div>
  );
}
