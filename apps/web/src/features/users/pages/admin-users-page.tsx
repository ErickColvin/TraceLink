import { Search, UserCog, UsersRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Badge, Button, Card, CardContent, Input, Label, buttonStyles } from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";

import { STAFF_USER_STATUSES, type StaffUserStatus } from "../domain";
import { useStaffRoles, useStaffUsers } from "../queries/user-queries";

const selectClassName = "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200";

function isUserStatus(value: string | null): value is StaffUserStatus {
  return STAFF_USER_STATUSES.some((status) => status === value);
}

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusValue = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const filters = {
    search: searchParams.get("search") || undefined,
    status: isUserStatus(statusValue) ? statusValue : undefined,
    roleId: searchParams.get("roleId") || undefined,
    page,
    pageSize: 8,
  };
  const usersQuery = useStaffUsers(filters);
  const rolesQuery = useStaffRoles();
  const roleLabels = new Map(rolesQuery.data?.map((role) => [role.id, role.label]));

  const updateFilter = (name: "search" | "status" | "roleId" | "page", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Accesos internos"
        title="Usuarios"
        description="Consulta cuentas de personal y administra su rol y estado de acceso."
        actions={<Link to="/app/roles" className={buttonStyles({ variant: "outline" })}><UserCog aria-hidden="true" /> Ver roles</Link>}
      />

      <Card className="mt-7">
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 sm:pt-6 xl:grid-cols-[2fr_1fr_1fr]">
          <div><Label htmlFor="users-search">Buscar</Label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" /><Input id="users-search" className="pl-10" placeholder="Nombre o correo" value={filters.search ?? ""} onChange={(event) => updateFilter("search", event.target.value)} /></div></div>
          <div><Label htmlFor="users-status">Estado</Label><select id="users-status" className={selectClassName} value={filters.status ?? ""} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Todos</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></div>
          <div><Label htmlFor="users-role">Rol</Label><select id="users-role" className={selectClassName} value={filters.roleId ?? ""} disabled={rolesQuery.isPending} onChange={(event) => updateFilter("roleId", event.target.value)}><option value="">Todos</option>{rolesQuery.data?.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></div>
        </CardContent>
      </Card>

      {usersQuery.isPending || rolesQuery.isPending ? (
        <div className="mt-6 space-y-3">{Array.from({ length: 5 }, (_, index) => <LoadingSkeleton key={index} className="h-20 rounded-2xl" />)}</div>
      ) : usersQuery.isError || rolesQuery.isError || !usersQuery.data ? (
        <ErrorState className="mt-6" title="No pudimos cargar los usuarios" description="Reintenta la consulta del directorio operativo." action={<Button onClick={() => { void usersQuery.refetch(); void rolesQuery.refetch(); }}>Reintentar</Button>} />
      ) : usersQuery.data.items.length === 0 ? (
        <EmptyState className="mt-6" icon={<UsersRound />} title="No hay usuarios para estos filtros" description="Prueba con otro nombre, estado o rol." action={<Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>Limpiar filtros</Button>} />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-600"><tr><th className="px-5 py-3">Usuario</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Último acceso</th><th className="px-5 py-3"><span className="sr-only">Acción</span></th></tr></thead>
                <tbody className="divide-y divide-ink-100">{usersQuery.data.items.map((user) => <tr key={user.id}><td className="px-5 py-4"><p className="font-semibold">{user.firstName} {user.lastName}</p><p className="text-xs text-ink-500">{user.email}</p></td><td className="px-5 py-4">{roleLabels.get(user.roleId) ?? "Rol desconocido"}</td><td className="px-5 py-4"><Badge tone={user.status === "ACTIVE" ? "success" : "neutral"}>{user.status === "ACTIVE" ? "Activo" : "Inactivo"}</Badge></td><td className="px-5 py-4 text-ink-600">{user.lastAccessAt ? formatDateTime(user.lastAccessAt) : "Sin acceso"}</td><td className="px-5 py-4 text-right"><Link className={buttonStyles({ variant: "ghost", size: "sm" })} to={`/app/users/${user.id}`}>Administrar</Link></td></tr>)}</tbody>
              </table>
            </div>
            <ul className="divide-y divide-ink-100 md:hidden">{usersQuery.data.items.map((user) => <li key={user.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{user.firstName} {user.lastName}</h2><p className="mt-1 break-all text-sm text-ink-600">{user.email}</p></div><Badge tone={user.status === "ACTIVE" ? "success" : "neutral"}>{user.status === "ACTIVE" ? "Activo" : "Inactivo"}</Badge></div><p className="mt-3 text-sm"><span className="text-ink-500">Rol:</span> <strong>{roleLabels.get(user.roleId) ?? "Rol desconocido"}</strong></p><Link className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4 w-full" })} to={`/app/users/${user.id}`}>Administrar usuario</Link></li>)}</ul>
          </Card>

          {usersQuery.data.totalPages > 1 ? (
            <nav aria-label="Paginación de usuarios" className="mt-5 flex items-center justify-between gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => updateFilter("page", String(page - 1))}>Anterior</Button><p className="text-sm text-ink-600">Página {page} de {usersQuery.data.totalPages}</p><Button variant="outline" disabled={page >= usersQuery.data.totalPages} onClick={() => updateFilter("page", String(page + 1))}>Siguiente</Button></nav>
          ) : null}
        </>
      )}
    </div>
  );
}
