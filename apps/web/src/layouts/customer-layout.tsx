import { useState } from "react";
import { ClipboardList, Home, LogOut, PackageSearch, UserRound } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { BrandLogo } from "@/components";
import { Alert, Button } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/formatters";

type CustomerNavigationItem = {
  label: string;
  to: string;
  icon: typeof Home;
  end?: boolean;
};

const customerNavigation: readonly CustomerNavigationItem[] = [
  { label: "Resumen", to: "/mi-cuenta", icon: Home, end: true },
  { label: "Mis pedidos", to: "/mi-cuenta/pedidos", icon: ClipboardList },
  { label: "Mis paquetes", to: "/mi-cuenta/paquetes", icon: PackageSearch },
  { label: "Mi perfil", to: "/mi-cuenta/perfil", icon: UserRound },
] as const;

export function CustomerLayout() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState(false);
  const customer = session.kind === "customer" ? session.customer : null;

  const handleSignOut = async () => {
    setLogoutError(false);
    try {
      await signOut();
      navigate("/");
    } catch {
      setLogoutError(true);
    }
  };

  return (
    <div className="min-h-screen bg-ice-50 text-ink-950">
      <a
        href="#contenido-cuenta"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-brand-950 px-4 py-2 font-semibold text-white transition-transform focus:translate-y-0"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label={`Volver a ${tenantBrand.name}`}>
            <BrandLogo name={tenantBrand.name} shortName={tenantBrand.shortName} />
          </Link>
          <div className="flex items-center gap-3">
            {customer ? (
              <div className="hidden text-right sm:block"><p className="text-sm font-bold">{customer.firstName} {customer.lastName}</p><p className="text-xs text-ink-500">Cuenta cliente</p></div>
            ) : null}
            {customer ? <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-800">{getInitials(customer.firstName, customer.lastName)}</span> : null}
          </div>
        </div>
      </header>

      <div className="border-b border-ink-100 bg-white lg:hidden">
        <nav data-allow-horizontal-overflow="true" aria-label="Navegación de mi cuenta" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {customerNavigation.map(({ end, icon: Icon, label, to }) => (
            <NavLink key={to} end={end} to={to} className={({ isActive }) => cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", isActive ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-ice-100")}><Icon aria-hidden="true" className="size-4" /> {label}</NavLink>
          ))}
        </nav>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:px-8 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-8 rounded-2xl border border-ink-100 bg-white p-3 shadow-card">
            <nav aria-label="Navegación de mi cuenta" className="space-y-1">
              {customerNavigation.map(({ end, icon: Icon, label, to }) => (
                <NavLink key={to} end={end} to={to} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors", isActive ? "bg-brand-700 text-white" : "text-ink-600 hover:bg-ice-100 hover:text-ink-950")}><Icon aria-hidden="true" className="size-4" /> {label}</NavLink>
              ))}
            </nav>
            <div className="my-3 border-t border-ink-100" />
            <Button variant="ghost" className="w-full justify-start" onClick={() => void handleSignOut()}><LogOut aria-hidden="true" /> Cerrar sesión</Button>
          </div>
        </aside>
        <main id="contenido-cuenta" tabIndex={-1} className="min-w-0">
          {logoutError ? <Alert tone="danger" className="mb-5"><LogOut aria-hidden="true" /><p>No pudimos cerrar la sesión. Inténtalo nuevamente.</p></Alert> : null}
          <Outlet />
          <Button variant="ghost" className="mt-8 w-full lg:hidden" onClick={() => void handleSignOut()}><LogOut aria-hidden="true" /> Cerrar sesión</Button>
        </main>
      </div>
    </div>
  );
}
