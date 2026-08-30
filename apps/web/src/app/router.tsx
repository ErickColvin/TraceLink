import { Navigate, Route, Routes } from "react-router-dom";
import { CustomerRoute, LoginPage, StaffRoute } from "@/features/auth";
import { CartPage } from "@/features/cart/cart-page";
import { CheckoutPage } from "@/features/checkout/pages/checkout-page";
import { AboutPage } from "@/features/content/pages/about-page";
import { ContactPage } from "@/features/content/pages/contact-page";
import { NotFoundPage } from "@/features/content/pages/not-found-page";
import { CustomerHomePage } from "@/features/customers/pages/customer-home-page";
import { CustomerProfilePage } from "@/features/customers/pages/customer-profile-page";
import { AdminComingSoonPage } from "@/features/dashboard/pages/admin-coming-soon-page";
import { AdminDashboardPage } from "@/features/dashboard/pages/admin-dashboard-page";
import { CustomerOrderDetailPage } from "@/features/orders/pages/customer-order-detail-page";
import { CustomerOrdersPage } from "@/features/orders/pages/customer-orders-page";
import { CustomerPackageDetailPage } from "@/features/packages/pages/customer-package-detail-page";
import { CustomerPackagesPage } from "@/features/packages/pages/customer-packages-page";
import { CatalogPage } from "@/features/products/pages/catalog-page";
import { HomePage } from "@/features/products/pages/home-page";
import { ProductDetailPage } from "@/features/products/pages/product-detail-page";
import { AdminSettingsPage } from "@/features/settings/pages/admin-settings-page";
import { AdminLayout } from "@/layouts/admin-layout";
import { CustomerLayout } from "@/layouts/customer-layout";
import { PublicLayout } from "@/layouts/public-layout";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="productos" element={<CatalogPage />} />
        <Route path="productos/:slug" element={<ProductDetailPage />} />
        <Route path="nosotros" element={<AboutPage />} />
        <Route path="contacto" element={<ContactPage />} />
        <Route path="carrito" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="registro" element={<Navigate replace to="/login" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="login" element={<LoginPage />} />

      <Route element={<CustomerRoute />}>
        <Route path="mi-cuenta" element={<CustomerLayout />}>
          <Route index element={<CustomerHomePage />} />
          <Route path="pedidos" element={<CustomerOrdersPage />} />
          <Route path="pedidos/:id" element={<CustomerOrderDetailPage />} />
          <Route path="paquetes" element={<CustomerPackagesPage />} />
          <Route path="paquetes/:id" element={<CustomerPackageDetailPage />} />
          <Route path="perfil" element={<CustomerProfilePage />} />
        </Route>
      </Route>

      <Route element={<StaffRoute />}>
        <Route path="app" element={<AdminLayout />}>
          <Route index element={<Navigate replace to="dashboard" />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route element={<StaffRoute permission="products.view" />}>
            <Route path="products" element={<AdminComingSoonPage title="Productos" description="Catálogo operativo, publicación y mantenimiento de productos." />} />
          </Route>
          <Route element={<StaffRoute permission="inventory.view" />}>
            <Route path="inventory" element={<AdminComingSoonPage title="Inventario" description="Stock disponible, mínimos, lotes, ubicaciones y vencimientos." />} />
          </Route>
          <Route element={<StaffRoute permission="orders.view" />}>
            <Route path="orders/*" element={<AdminComingSoonPage title="Pedidos" description="Preparación, estados, excepciones y coordinación de entrega." />} />
          </Route>
          <Route element={<StaffRoute permission="packages.view" />}>
            <Route path="packages/*" element={<AdminComingSoonPage title="Paquetes" description="Recepción, almacenamiento, trazabilidad y entrega." />} />
          </Route>
          <Route element={<StaffRoute permission="customers.view" />}>
            <Route path="customers" element={<AdminComingSoonPage title="Clientes" description="Gestión operacional de clientes con acceso autorizado." />} />
          </Route>
          <Route element={<StaffRoute permission="users.view" />}>
            <Route path="users" element={<AdminComingSoonPage title="Usuarios" description="Cuentas de personal y estado de acceso." />} />
          </Route>
          <Route element={<StaffRoute permission="users.manage" />}>
            <Route path="roles" element={<AdminComingSoonPage title="Roles y permisos" description="Permisos granulares para cada función operativa." />} />
          </Route>
          <Route element={<StaffRoute permission="reports.view" />}>
            <Route path="reports" element={<AdminComingSoonPage title="Reportes" description="Salidas operativas acotadas y exportaciones futuras." />} />
          </Route>
          <Route element={<StaffRoute permission="settings.manage" />}>
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
          <Route path="*" element={<AdminComingSoonPage title="Módulo no disponible" description="La ruta solicitada aún no forma parte de esta entrega." />} />
        </Route>
      </Route>
    </Routes>
  );
}
