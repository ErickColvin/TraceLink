import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  UserCog,
  UsersRound,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { BrandLogo } from "@/components";
import { Alert, Button, buttonStyles } from "@/components/ui";
import { useAuth, type Permission } from "@/features/auth";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/formatters";

type AdminNavigationItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: Permission;
  end?: boolean;
};

const adminNavigation: readonly AdminNavigationItem[] = [
  { label: "Dashboard", to: "/app/dashboard", icon: LayoutDashboard, end: true },
  { label: "Productos", to: "/app/products", icon: ShoppingBasket, permission: "products.view" },
  { label: "Inventario", to: "/app/inventory", icon: Warehouse, permission: "inventory.view" },
  { label: "Pedidos", to: "/app/orders", icon: ClipboardList, permission: "orders.view" },
  { label: "Paquetes", to: "/app/packages", icon: PackageSearch, permission: "packages.view" },
  { label: "Clientes", to: "/app/customers", icon: UsersRound, permission: "customers.view" },
  { label: "Usuarios", to: "/app/users", icon: UserCog, permission: "users.view" },
  { label: "Roles", to: "/app/roles", icon: ShieldCheck, permission: "users.manage" },
  { label: "Reportes", to: "/app/reports", icon: BarChart3, permission: "reports.view" },
  { label: "Configuración", to: "/app/settings", icon: Settings, permission: "settings.manage" },
];

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPermission } = useAuth();
  const visibleItems = adminNavigation.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <nav aria-label="Navegación administrativa" className="space-y-1">
      {visibleItems.map(({ end, icon: Icon, label, to }) => (
        <NavLink
          key={to}
          end={end}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) => cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
            isActive ? "bg-white text-brand-950 shadow-sm" : "text-ice-200 hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon aria-hidden="true" className="size-4.5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const drawerButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const staff = session.kind === "staff" ? session.staff : null;
  const currentItem = adminNavigation.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }

      if (event.key === "Tab" && drawerRef.current) {
        const focusable = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = focusable.at(0);
        const last = focusable.at(-1);

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    const closeDrawerOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };

    desktopViewport.addEventListener("change", closeDrawerOnDesktop);
    return () => desktopViewport.removeEventListener("change", closeDrawerOnDesktop);
  }, []);

  const handleSignOut = async () => {
    setLogoutError(false);
    try {
      await signOut();
      navigate("/");
    } catch {
      setLogoutError(true);
    }
  };

  const sidebarContents = (
    <div className="flex h-full flex-col bg-brand-950 px-3 py-4 text-white">
      <Link to="/app/dashboard" className="px-2 py-2" onClick={() => setDrawerOpen(false)}>
        <BrandLogo className="text-white" name={`${tenantBrand.name} Operaciones`} shortName={tenantBrand.shortName} />
      </Link>
      <div className="my-5 border-t border-white/10" />
      <AdminNavigation onNavigate={drawerOpen ? closeDrawer : undefined} />
      <div className="mt-auto pt-6">
        <div className="rounded-xl bg-white/8 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-ice-300">Sesión demo</p>
          <p className="mt-1 truncate text-sm font-semibold">{staff?.roleLabel ?? "Personal autorizado"}</p>
        </div>
        <Button variant="ghost" className="mt-2 w-full justify-start text-ice-100 hover:bg-white/10 hover:text-white" onClick={() => void handleSignOut()}><LogOut aria-hidden="true" /> Cerrar sesión</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ice-50 text-ink-950 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <a
        href="#contenido-admin"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-brand-950 px-4 py-2 font-semibold text-white transition-transform focus:translate-y-0"
      >
        Saltar al contenido
      </a>
      <aside className="hidden min-h-screen lg:block">{sidebarContents}</aside>

      {drawerOpen ? (
        <div ref={drawerRef} className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú administrativo">
          <button type="button" tabIndex={-1} className="absolute inset-0 bg-ink-950/55" aria-label="Cerrar menú" onClick={closeDrawer} />
          <aside className="relative h-full w-[min(86vw,290px)] shadow-lifted">
            <button ref={drawerCloseRef} type="button" aria-label="Cerrar menú" className={buttonStyles({ variant: "ghost", size: "icon", className: "absolute right-3 top-3 z-10 text-white hover:bg-white/10" })} onClick={closeDrawer}><X aria-hidden="true" /></button>
            {sidebarContents}
          </aside>
        </div>
      ) : null}

      <div data-admin-content className="min-w-0" inert={drawerOpen}>
        <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
          <div className="flex h-18 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button ref={drawerButtonRef} type="button" aria-label="Abrir menú administrativo" aria-expanded={drawerOpen} className={buttonStyles({ variant: "ghost", size: "icon", className: "lg:hidden" })} onClick={() => setDrawerOpen(true)}><Menu aria-hidden="true" /></button>
              <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-brand-700">Operaciones</p><p className="font-display text-lg font-bold">{currentItem?.label ?? tenantBrand.name}</p></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span role="img" className="relative grid size-11 place-items-center text-ink-700" aria-label="Hay notificaciones pendientes en la demostración"><Bell aria-hidden="true" /><span aria-hidden="true" className="absolute right-1 top-1 size-2 rounded-full bg-coral-500" /></span>
              {staff ? <div className="hidden text-right sm:block"><p className="text-sm font-bold">{staff.firstName} {staff.lastName}</p><p className="text-xs text-ink-500">{staff.roleLabel}</p></div> : null}
              {staff ? <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-800">{getInitials(staff.firstName, staff.lastName)}</span> : null}
            </div>
          </div>
        </header>
        <main id="contenido-admin" tabIndex={-1} className="p-4 sm:p-6 lg:p-8">
          {logoutError ? <Alert tone="danger" className="mb-5"><LogOut aria-hidden="true" /><p>No pudimos cerrar la sesión. Inténtalo nuevamente.</p></Alert> : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
