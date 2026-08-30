import { Link } from "react-router-dom";

import type { Permission } from "../model/auth";
import { STAFF_HOME_PATH } from "../routing/auth-paths";

export function SessionLoading() {
  return (
    <div
      aria-live="polite"
      className="flex min-h-48 items-center justify-center px-6 text-sm text-ink-600"
      role="status"
    >
      Cargando tu sesión…
    </div>
  );
}

export function PermissionDenied({ permission }: { permission: Permission }) {
  return (
    <section
      aria-labelledby="permission-denied-title"
      className="mx-auto my-10 max-w-xl rounded-xl border border-ink-100 bg-white p-6 text-ink-950 shadow-sm"
      role="alert"
    >
      <p className="text-sm font-semibold text-ink-600">
        Permiso requerido: {permission}
      </p>
      <h1
        className="mt-2 text-2xl font-semibold tracking-tight"
        id="permission-denied-title"
      >
        Acceso restringido
      </h1>
      <p className="mt-3 text-sm leading-6 text-ink-600">
        Tu perfil no tiene autorización para ver esta sección. Si necesitas
        acceso, solicítalo a la persona administradora de tu organización.
      </p>
      <Link
        className="mt-6 inline-flex min-h-10 items-center justify-center rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-950 shadow-sm transition-colors hover:border-brand-300 hover:bg-ice-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        to={STAFF_HOME_PATH}
      >
        Volver al dashboard
      </Link>
    </section>
  );
}
