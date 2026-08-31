import { Navigate, Route, Routes } from "react-router-dom";
import { CustomerRoute, LoginPage, StaffRoute } from "@/features/auth";
import { CartPage } from "@/features/cart/cart-page";
import { CheckoutPage } from "@/features/checkout/pages/checkout-page";
import { AboutPage } from "@/features/content/pages/about-page";
import { ContactPage } from "@/features/content/pages/contact-page";
import { NotFoundPage } from "@/features/content/pages/not-found-page";
import { CustomerHomePage } from "@/features/customers/pages/customer-home-page";
import { CustomerProfilePage } from "@/features/customers/pages/customer-profile-page";
import { AdminCustomerDetailPage, AdminCustomersPage } from "@/features/customers";
import { AdminComingSoonPage } from "@/features/dashboard/pages/admin-coming-soon-page";
import { AdminDashboardPage } from "@/features/dashboard/pages/admin-dashboard-page";
import { AdminInventoryMovementsPage, AdminInventoryPage } from "@/features/inventory";
import { CustomerOrderDetailPage } from "@/features/orders/pages/customer-order-detail-page";
import { CustomerOrdersPage } from "@/features/orders/pages/customer-orders-page";
import { AdminOrderDetailPage } from "@/features/orders/pages/admin-order-detail-page";
import { AdminOrdersPage } from "@/features/orders/pages/admin-orders-page";
import { CustomerPackageDetailPage } from "@/features/packages/pages/customer-package-detail-page";
import { CustomerPackagesPage } from "@/features/packages/pages/customer-packages-page";
import {
  AdminPackageCreatePage,
  AdminPackageDetailPage,
  AdminPackagesPage,
} from "@/features/packages";
import { CatalogPage } from "@/features/products/pages/catalog-page";
import { HomePage } from "@/features/products/pages/home-page";
import { ProductDetailPage } from "@/features/products/pages/product-detail-page";
import {
  AdminProductCreatePage,
  AdminProductDetailPage,
  AdminProductEditPage,
  AdminProductsPage,
} from "@/features/products";
import { AdminReportsPage } from "@/features/reports/pages/admin-reports-page";
import { AdminSettingsPage } from "@/features/settings/pages/admin-settings-page";
import { AdminRolesPage } from "@/features/users/pages/admin-roles-page";
import { AdminUserDetailPage } from "@/features/users/pages/admin-user-detail-page";
import { AdminUsersPage } from "@/features/users/pages/admin-users-page";
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
            <Route path="products" element={<AdminProductsPage />} />
            <Route element={<StaffRoute permission="products.create" />}>
              <Route path="products/new" element={<AdminProductCreatePage />} />
            </Route>
            <Route path="products/:id" element={<AdminProductDetailPage />} />
            <Route element={<StaffRoute permission="products.update" />}>
              <Route path="products/:id/edit" element={<AdminProductEditPage />} />
            </Route>
          </Route>
          <Route element={<StaffRoute permission="inventory.view" />}>
            <Route path="inventory" element={<AdminInventoryPage />} />
            <Route path="inventory/movements" element={<AdminInventoryMovementsPage />} />
          </Route>
          <Route element={<StaffRoute permission="orders.view" />}>
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          </Route>
          <Route element={<StaffRoute permission="packages.view" />}>
            <Route path="packages" element={<AdminPackagesPage />} />
            <Route element={<StaffRoute permission="packages.receive" />}>
              <Route path="packages/new" element={<AdminPackageCreatePage />} />
            </Route>
            <Route path="packages/:id" element={<AdminPackageDetailPage />} />
          </Route>
          <Route element={<StaffRoute permission="customers.view" />}>
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
          </Route>
          <Route element={<StaffRoute permission="users.view" />}>
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
          </Route>
          <Route element={<StaffRoute permission="users.manage" />}>
            <Route path="roles" element={<AdminRolesPage />} />
          </Route>
          <Route element={<StaffRoute permission="reports.view" />}>
            <Route path="reports" element={<AdminReportsPage />} />
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
