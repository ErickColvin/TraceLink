import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Menu,
  PackageSearch,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { tenantBrand } from "@/app/config/brand";
import { BrandLogo } from "@/components";
import { buttonStyles } from "@/components/ui";
import { useCart } from "@/features/cart/use-cart";
import { cn } from "@/lib/cn";

type PublicNavigationItem = {
  label: string;
  to: string;
  end?: boolean;
};

const publicNavigation: readonly PublicNavigationItem[] = [
  { label: "Inicio", to: "/", end: true },
  { label: "Productos", to: "/productos" },
  { label: "Nosotros", to: "/nosotros" },
  { label: "Contacto", to: "/contacto" },
] as const;

function PublicNavLink({
  end,
  label,
  onNavigate,
  to,
}: PublicNavigationItem & { onNavigate?: () => void }) {
  return (
    <NavLink
      end={end}
      onClick={onNavigate}
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
          isActive
            ? "bg-brand-50 text-brand-800"
            : "text-ink-700 hover:bg-ice-100 hover:text-brand-800",
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { itemCount } = useCart();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-white text-ink-950">
      <a
        href="#contenido-principal"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-brand-950 px-4 py-2 font-semibold text-white transition-transform focus:translate-y-0"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/95 backdrop-blur-md">
        <div className="bg-brand-950 text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6 lg:px-8">
            <p className="font-medium">Compra simple · retiro coordinado</p>
            <Link
              to="/login?returnTo=/mi-cuenta/paquetes"
              className="inline-flex items-center gap-1 font-semibold text-ice-200 hover:text-white"
            >
              <PackageSearch aria-hidden="true" className="size-4" />
              Seguir un paquete
            </Link>
          </div>
        </div>

        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label={`${tenantBrand.name}, ir al inicio`}>
            <BrandLogo
              name={tenantBrand.name}
              shortName={tenantBrand.shortName}
              size="md"
            />
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center lg:flex">
            {publicNavigation.map((item) => (
              <PublicNavLink key={item.to} {...item} />
            ))}
            <NavLink
              to="/login?returnTo=/mi-cuenta/paquetes"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ice-100 hover:text-brand-800"
            >
              Seguimiento
            </NavLink>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/carrito"
              aria-label={`Carrito con ${itemCount} ${itemCount === 1 ? "producto" : "productos"}`}
              className={buttonStyles({
                variant: "ghost",
                size: "icon",
                className: "relative",
              })}
            >
              <ShoppingBag aria-hidden="true" />
              {itemCount > 0 ? (
                <span className="absolute right-0.5 top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[0.68rem] font-extrabold text-white">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              ) : null}
            </Link>

            <span className="hidden sm:inline-flex">
              <Link
                to="/login"
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                <UserRound aria-hidden="true" />
                Iniciar sesión
              </Link>
            </span>

            <button
              ref={menuButtonRef}
              type="button"
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              className={buttonStyles({
                variant: "ghost",
                size: "icon",
                className: "lg:hidden",
              })}
              onClick={() => setMenuOpen((current) => !current)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            id="mobile-navigation"
            aria-label="Navegación móvil"
            className="border-t border-ink-100 bg-white px-4 py-4 shadow-card lg:hidden"
          >
            <div className="mx-auto grid max-w-7xl gap-1">
              {publicNavigation.map((item) => (
                <PublicNavLink key={item.to} {...item} onNavigate={closeMenu} />
              ))}
              <Link
                to="/login?returnTo=/mi-cuenta/paquetes"
                onClick={closeMenu}
                className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-ink-700 hover:bg-ice-100"
              >
                Seguimiento / Mis paquetes
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                to="/login"
                onClick={closeMenu}
                className={buttonStyles({
                  className: "mt-2 w-full sm:hidden",
                })}
              >
                Iniciar sesión
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main id="contenido-principal" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="border-t border-brand-900 bg-brand-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr] lg:px-8">
          <div>
            <BrandLogo
              className="text-white"
              name={tenantBrand.name}
              shortName={tenantBrand.shortName}
            />
            <p className="mt-4 max-w-sm text-sm leading-6 text-ice-200">
              Productos seleccionados, compra clara y trazabilidad para que siempre sepas qué viene después.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-ice-300">
              Explorar
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-ice-100">
              <li><Link className="hover:text-white" to="/productos">Productos</Link></li>
              <li><Link className="hover:text-white" to="/nosotros">Nosotros</Link></li>
              <li><Link className="hover:text-white" to="/contacto">Contacto</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-ice-300">
              Tu cuenta
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-ice-100">
              <li><Link className="hover:text-white" to="/login">Iniciar sesión</Link></li>
              <li><Link className="hover:text-white" to="/login?returnTo=/mi-cuenta/pedidos">Mis pedidos</Link></li>
              <li><Link className="hover:text-white" to="/login?returnTo=/mi-cuenta/paquetes">Mis paquetes</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ice-300 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© {currentYear} {tenantBrand.name}. Experiencia demo frontend.</p>
            <p>Plataforma TraceLink · {tenantBrand.organization}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
