import { useState } from "react";
import { ArrowLeft, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { ConfirmationDialog, ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Label, buttonStyles } from "@/components/ui";
import { useHasPermission } from "@/features/auth";
import { formatDateTime } from "@/lib/formatters";

import { STAFF_USER_STATUSES } from "../domain";
import type { StaffRoleDefinition, StaffUser, StaffUserStatus } from "../domain";
import { useStaffRoles, useStaffUser, useUpdateStaffUser } from "../queries/user-queries";

const selectClassName = "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:bg-ink-50";

function UserEditor({ roles, user }: { roles: StaffRoleDefinition[]; user: StaffUser }) {
  const canManage = useHasPermission("users.manage");
  const updateUser = useUpdateStaffUser();
  const [roleId, setRoleId] = useState(user.roleId);
  const [status, setStatus] = useState<StaffUserStatus>(user.status);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const changed = roleId !== user.roleId || status !== user.status;
  const selectedRole = roles.find((role) => role.id === roleId);

  const confirmUpdate = async () => {
    setSaved(false);
    try {
      await updateUser.mutateAsync({ id: user.id, roleId, status });
      setDialogOpen(false);
      setSaved(true);
    } catch {
      setDialogOpen(false);
    }
  };

  return (
    <>
      {saved ? <Alert tone="success" role="status" className="mt-6"><Save aria-hidden="true" /><p>Rol y estado actualizados en el servicio mock.</p></Alert> : null}
      {updateUser.isError ? <Alert tone="danger" className="mt-6"><p>No pudimos actualizar el usuario. Inténtalo nuevamente.</p></Alert> : null}

      <div className="mt-7 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle>Cuenta de personal</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-3"><UserRound aria-hidden="true" className="mt-0.5 size-5 text-brand-700" /><div><p className="text-xs font-bold uppercase tracking-wide text-ink-500">Nombre</p><p className="mt-1 font-semibold">{user.firstName} {user.lastName}</p></div></div>
            <div className="flex gap-3"><Mail aria-hidden="true" className="mt-0.5 size-5 text-brand-700" /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-ink-500">Correo</p><p className="mt-1 break-all font-semibold">{user.email}</p></div></div>
            <dl className="grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><div><dt className="text-xs text-ink-500">Creado</dt><dd className="mt-1 font-semibold">{formatDateTime(user.createdAt)}</dd></div><div><dt className="text-xs text-ink-500">Último acceso</dt><dd className="mt-1 font-semibold">{user.lastAccessAt ? formatDateTime(user.lastAccessAt) : "Sin acceso"}</dd></div></dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rol y acceso</CardTitle><p className="text-sm text-ink-600">La interfaz habilita estas acciones por el permiso <code>users.manage</code>, no por el nombre de un rol.</p></CardHeader>
          <CardContent className="space-y-5">
            <div><Label htmlFor="user-role">Rol</Label><select id="user-role" className={selectClassName} value={roleId} disabled={!canManage || updateUser.isPending} onChange={(event) => { setRoleId(event.target.value); setSaved(false); }}>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select>{selectedRole ? <p className="mt-1.5 text-xs text-ink-500">{selectedRole.description} · {selectedRole.permissions.length} permisos</p> : null}</div>
            <div><Label htmlFor="user-status">Estado</Label><select id="user-status" className={selectClassName} value={status} disabled={!canManage || updateUser.isPending} onChange={(event) => { const nextStatus = STAFF_USER_STATUSES.find((candidate) => candidate === event.currentTarget.value); if (nextStatus) { setStatus(nextStatus); setSaved(false); } }}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></div>
            {canManage ? <Button size="lg" disabled={!changed || updateUser.isPending} onClick={() => setDialogOpen(true)}><ShieldCheck aria-hidden="true" /> Revisar cambio</Button> : <Alert tone="warning"><p>Tu sesión puede consultar usuarios, pero no administrar sus accesos.</p></Alert>}
          </CardContent>
        </Card>
      </div>

      <ConfirmationDialog
        open={dialogOpen}
        title="Confirmar cambios de acceso"
        description={`Asignarás el rol ${selectedRole?.label ?? "seleccionado"} y dejarás la cuenta ${status === "ACTIVE" ? "activa" : "inactiva"}.`}
        confirmLabel="Actualizar usuario"
        cancelLabel="Revisar"
        tone={status === "INACTIVE" ? "danger" : "primary"}
        pending={updateUser.isPending}
        onConfirm={() => void confirmUpdate()}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

export function AdminUserDetailPage() {
  const { id } = useParams();
  const userQuery = useStaffUser(id);
  const rolesQuery = useStaffRoles();

  if (userQuery.isPending || rolesQuery.isPending) {
    return <div className="space-y-6"><LoadingSkeleton className="h-24 rounded-2xl" /><LoadingSkeleton className="h-80 rounded-2xl" /></div>;
  }

  if (userQuery.isError || rolesQuery.isError || !userQuery.data || !rolesQuery.data) {
    return <ErrorState title="No pudimos cargar el usuario" description="El registro no existe o el directorio no está disponible." action={<Link to="/app/users" className={buttonStyles({ variant: "outline" })}>Volver a usuarios</Link>} />;
  }

  return (
    <div>
      <Link to="/app/users" className={buttonStyles({ variant: "ghost", size: "sm", className: "mb-4" })}><ArrowLeft aria-hidden="true" /> Volver a usuarios</Link>
      <PageHeader eyebrow="Usuario interno" title={`${userQuery.data.firstName} ${userQuery.data.lastName}`} description="Administra el alcance operativo y el estado de esta cuenta." actions={<Badge tone={userQuery.data.status === "ACTIVE" ? "success" : "neutral"}>{userQuery.data.status === "ACTIVE" ? "Activo" : "Inactivo"}</Badge>} />
      <UserEditor key={`${userQuery.data.id}-${userQuery.data.roleId}-${userQuery.data.status}`} user={userQuery.data} roles={rolesQuery.data} />
    </div>
  );
}
