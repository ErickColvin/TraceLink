import { useState } from "react";
import { KeyRound, Save, ShieldCheck } from "lucide-react";

import { ConfirmationDialog, EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PERMISSIONS, useHasPermission, type Permission } from "@/features/auth";
import { cn } from "@/lib/cn";

import type { StaffRoleDefinition } from "../domain";
import { useStaffRoles, useUpdateRolePermissions } from "../queries/user-queries";

const resourceLabels: Record<string, string> = {
  products: "Productos",
  inventory: "Inventario",
  orders: "Pedidos",
  packages: "Paquetes",
  customers: "Clientes",
  users: "Usuarios y roles",
  reports: "Reportes",
  settings: "Configuración",
};

const actionLabels: Record<string, string> = {
  view: "Ver",
  create: "Crear",
  update: "Actualizar",
  delete: "Eliminar",
  adjust: "Registrar movimientos",
  cancel: "Cancelar",
  receive: "Recibir",
  deliver: "Entregar",
  manage: "Administrar",
};

function PermissionEditor({ role }: { role: StaffRoleDefinition }) {
  const canManage = useHasPermission("users.manage");
  const updatePermissions = useUpdateRolePermissions();
  const [selected, setSelected] = useState<Permission[]>(role.permissions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const protectedRole = role.code === "SUPER_ADMIN";
  const changed = selected.length !== role.permissions.length || selected.some((permission) => !role.permissions.includes(permission));
  const grouped = Object.entries(
    PERMISSIONS.reduce<Record<string, Permission[]>>((groups, permission) => {
      const resource = permission.split(".")[0] ?? "other";
      groups[resource] = [...(groups[resource] ?? []), permission];
      return groups;
    }, {}),
  );

  const togglePermission = (permission: Permission) => {
    setSaved(false);
    setSelected((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const confirmSave = async () => {
    try {
      await updatePermissions.mutateAsync({ id: role.id, permissions: selected });
      setDialogOpen(false);
      setSaved(true);
    } catch {
      setDialogOpen(false);
    }
  };

  return (
    <>
      {protectedRole ? <Alert tone="info" className="mb-5"><ShieldCheck aria-hidden="true" /><p>Superadministración conserva todos los permisos para evitar perder el control operativo.</p></Alert> : null}
      {saved ? <Alert tone="success" role="status" className="mb-5"><Save aria-hidden="true" /><p>Permisos guardados en el adapter mock.</p></Alert> : null}
      {updatePermissions.isError ? <Alert tone="danger" className="mb-5"><p>No pudimos guardar los permisos. Inténtalo nuevamente.</p></Alert> : null}

      <div className="space-y-5">
        {grouped.map(([resource, permissions]) => (
          <fieldset key={resource} className="rounded-xl border border-ink-100 p-4">
            <legend className="px-1 font-bold">{resourceLabels[resource] ?? resource}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {permissions.map((permission) => {
                const action = permission.split(".")[1] ?? permission;
                return (
                  <label key={permission} className={cn("flex items-start gap-3 rounded-xl border border-ink-100 p-3", selected.includes(permission) && "border-brand-300 bg-brand-50", (protectedRole || !canManage) && "cursor-not-allowed opacity-70")}>
                    <input type="checkbox" className="mt-0.5 size-4 accent-brand-700" checked={selected.includes(permission)} disabled={protectedRole || !canManage || updatePermissions.isPending} onChange={() => togglePermission(permission)} />
                    <span><span className="block text-sm font-semibold">{actionLabels[action] ?? action}</span><code className="mt-1 block text-xs text-ink-500">{permission}</code></span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-ink-600">{selected.length} de {PERMISSIONS.length} permisos seleccionados.</p>
        <Button disabled={!canManage || protectedRole || !changed || updatePermissions.isPending} onClick={() => setDialogOpen(true)}><Save aria-hidden="true" /> Guardar permisos</Button>
      </div>

      <ConfirmationDialog open={dialogOpen} title="Confirmar permisos del rol" description={`El rol ${role.label} quedará con ${selected.length} permisos. Este cambio afecta la experiencia de sus usuarios.`} confirmLabel="Guardar permisos" cancelLabel="Revisar" tone="primary" pending={updatePermissions.isPending} onConfirm={() => void confirmSave()} onOpenChange={setDialogOpen} />
    </>
  );
}

export function AdminRolesPage() {
  const rolesQuery = useStaffRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  if (rolesQuery.isPending) {
    return <div className="space-y-6"><LoadingSkeleton className="h-24 rounded-2xl" /><div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <LoadingSkeleton key={index} className="h-36 rounded-2xl" />)}</div></div>;
  }

  if (rolesQuery.isError || !rolesQuery.data) {
    return <ErrorState title="No pudimos cargar los roles" description="Reintenta la consulta de permisos." action={<Button onClick={() => void rolesQuery.refetch()}>Reintentar</Button>} />;
  }

  if (rolesQuery.data.length === 0) {
    return <EmptyState icon={<KeyRound />} title="No hay roles configurados" description="Los roles del sistema aparecerán aquí." />;
  }

  const selectedRole = rolesQuery.data.find((role) => role.id === selectedRoleId) ?? rolesQuery.data[0];
  if (!selectedRole) return null;

  return (
    <div>
      <PageHeader eyebrow="Autorización UX" title="Roles y permisos" description="Define permisos granulares para las seis funciones iniciales. El backend futuro deberá volver a validarlos." />
      <div className="mt-7 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
        <nav aria-label="Roles disponibles" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {rolesQuery.data.map((role) => <button key={role.id} type="button" aria-current={role.id === selectedRole.id ? "true" : undefined} className={cn("rounded-2xl border bg-white p-5 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500", role.id === selectedRole.id ? "border-brand-500 bg-brand-50" : "border-ink-100 hover:border-brand-200")} onClick={() => setSelectedRoleId(role.id)}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{role.label}</p><code className="mt-1 block text-xs text-ink-500">{role.code}</code></div><Badge tone={role.code === "SUPER_ADMIN" ? "brand" : "neutral"}>{role.permissions.length}</Badge></div><p className="mt-3 text-sm leading-5 text-ink-600">{role.description}</p></button>)}
        </nav>

        <Card>
          <CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle>{selectedRole.label}</CardTitle><Badge tone="info">{selectedRole.code}</Badge></div><p className="text-sm text-ink-600">Selecciona capacidades. La navegación y cada ruta aplican permisos específicos.</p></CardHeader>
          <CardContent><PermissionEditor key={`${selectedRole.id}-${selectedRole.permissions.join("-")}`} role={selectedRole} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
