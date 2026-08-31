import { lazy, Suspense, type PropsWithChildren } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { CustomerRoute, LoginPage, StaffRoute } from "@/features/auth";
import { CartPage } from "@/features/cart/cart-page";
import { AboutPage } from "@/features/content/pages/about-page";
import { ContactPage } from "@/features/content/pages/contact-page";
import { NotFoundPage } from "@/features/content/pages/not-found-page";
import { CustomerHomePage } from "@/features/customers/pages/customer-home-page";
import { CustomerProfilePage } from "@/features/customers/pages/customer-profile-page";
import { AdminComingSoonPage } from "@/features/dashboard/pages/admin-coming-soon-page";
import { CustomerOrderDetailPage } from "@/features/orders/pages/customer-order-detail-page";
import { CustomerOrdersPage } from "@/features/orders/pages/customer-orders-page";
import { CustomerPackageDetailPage } from "@/features/packages/pages/customer-package-detail-page";
import { CustomerPackagesPage } from "@/features/packages/pages/customer-packages-page";
import { CatalogPage } from "@/features/products/pages/catalog-page";
import { HomePage } from "@/features/products/pages/home-page";
import { ProductDetailPage } from "@/features/products/pages/product-detail-page";
import { AdminLayout } from "@/layouts/admin-layout";
import { CustomerLayout } from "@/layouts/customer-layout";
import { PublicLayout } from "@/layouts/public-layout";

const CheckoutPage = lazy(() =>
  import("@/features/checkout/pages/checkout-page").then((module) => ({ default: module.CheckoutPage })),
);
const AdminDashboardPage = lazy(() =>
  import("@/features/dashboard/pages/admin-dashboard-page").then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminInventoryPage = lazy(() =>
  import("@/features/inventory/pages/admin-inventory-page").then((module) => ({ default: module.AdminInventoryPage })),
);
const AdminInventoryMovementsPage = lazy(() =>
  import("@/features/inventory/pages/admin-inventory-movements-page").then((module) => ({ default: module.AdminInventoryMovementsPage })),
);
const AdminOrdersPage = lazy(() =>
  import("@/features/orders/pages/admin-orders-page").then((module) => ({ default: module.AdminOrdersPage })),
);
const AdminOrderDetailPage = lazy(() =>
  import("@/features/orders/pages/admin-order-detail-page").then((module) => ({ default: module.AdminOrderDetailPage })),
);
const AdminPackagesPage = lazy(() =>
  import("@/features/packages/pages/admin-packages-page").then((module) => ({ default: module.AdminPackagesPage })),
);
const AdminPackageCreatePage = lazy(() =>
  import("@/features/packages/pages/admin-package-create-page").then((module) => ({ default: module.AdminPackageCreatePage })),
);
const AdminPackageDetailPage = lazy(() =>
  import("@/features/packages/pages/admin-package-detail-page").then((module) => ({ default: module.AdminPackageDetailPage })),
);
const AdminCustomersPage = lazy(() =>
  import("@/features/customers/pages/admin-customers-page").then((module) => ({ default: module.AdminCustomersPage })),
);
const AdminCustomerDetailPage = lazy(() =>
  import("@/features/customers/pages/admin-customer-detail-page").then((module) => ({ default: module.AdminCustomerDetailPage })),
);
const AdminProductsPage = lazy(() =>
  import("@/features/products/pages/admin-products-page").then((module) => ({ default: module.AdminProductsPage })),
);
const AdminProductCreatePage = lazy(() =>
  import("@/features/products/pages/admin-product-form-pages").then((module) => ({ default: module.AdminProductCreatePage })),
);
const AdminProductEditPage = lazy(() =>
  import("@/features/products/pages/admin-product-form-pages").then((module) => ({ default: module.AdminProductEditPage })),
);
const AdminProductDetailPage = lazy(() =>
  import("@/features/products/pages/admin-product-detail-page").then((module) => ({ default: module.AdminProductDetailPage })),
);
const AdminUsersPage = lazy(() =>
  import("@/features/users/pages/admin-users-page").then((module) => ({ default: module.AdminUsersPage })),
);
const AdminUserDetailPage = lazy(() =>
  import("@/features/users/pages/admin-user-detail-page").then((module) => ({ default: module.AdminUserDetailPage })),
);
const AdminRolesPage = lazy(() =>
  import("@/features/users/pages/admin-roles-page").then((module) => ({ default: module.AdminRolesPage })),
);
const AdminReportsPage = lazy(() =>
  import("@/features/reports/pages/admin-reports-page").then((module) => ({ default: module.AdminReportsPage })),
);
const AdminSettingsPage = lazy(() =>
  import("@/features/settings/pages/admin-settings-page").then((module) => ({ default: module.AdminSettingsPage })),
);

function DeferredRoute({ children }: PropsWithChildren) {
  return (
    <Suspense
      fallback={(
        <div className="grid min-h-64 place-items-center rounded-2xl border border-ink-100 bg-white p-6 text-sm font-semibold text-ink-600 shadow-card" role="status">
          Cargando vista…
        </div>
      )}
    >
      {children}
    </Suspense>
  );
}

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
        <Route path="checkout" element={<DeferredRoute><CheckoutPage /></DeferredRoute>} />
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
          <Route path="dashboard" element={<DeferredRoute><AdminDashboardPage /></DeferredRoute>} />
          <Route element={<StaffRoute permission="products.view" />}>
            <Route path="products" element={<DeferredRoute><AdminProductsPage /></DeferredRoute>} />
            <Route element={<StaffRoute permission="products.create" />}>
              <Route path="products/new" element={<DeferredRoute><AdminProductCreatePage /></DeferredRoute>} />
            </Route>
            <Route path="products/:id" element={<DeferredRoute><AdminProductDetailPage /></DeferredRoute>} />
            <Route element={<StaffRoute permission="products.update" />}>
              <Route path="products/:id/edit" element={<DeferredRoute><AdminProductEditPage /></DeferredRoute>} />
            </Route>
          </Route>
          <Route element={<StaffRoute permission="inventory.view" />}>
            <Route path="inventory" element={<DeferredRoute><AdminInventoryPage /></DeferredRoute>} />
            <Route path="inventory/movements" element={<DeferredRoute><AdminInventoryMovementsPage /></DeferredRoute>} />
          </Route>
          <Route element={<StaffRoute permission="orders.view" />}>
            <Route path="orders" element={<DeferredRoute><AdminOrdersPage /></DeferredRoute>} />
            <Route path="orders/:id" element={<DeferredRoute><AdminOrderDetailPage /></DeferredRoute>} />
          </Route>
          <Route element={<StaffRoute permission="packages.view" />}>
            <Route path="packages" element={<DeferredRoute><AdminPackagesPage /></DeferredRoute>} />
            <Route element={<StaffRoute permission="packages.receive" />}>
              <Route path="packages/new" element={<DeferredRoute><AdminPackageCreatePage /></DeferredRoute>} />
            </Route>
            <Route path="packages/:id" element={<DeferredRoute><AdminPackageDetailPage /></DeferredRoute>} />
          </Route>
          <Route element={<StaffRoute permission="customers.view" />}>
            <Route path="customers" element={<DeferredRoute><AdminCustomersPage /></DeferredRoute>} />
            <Route path="customers/:id" element={<DeferredRoute><AdminCustomerDetailPage /></DeferredRoute>} />
          </Route>
          <Route element={<StaffRoute permission="users.view" />}>
            <Route path="users" element={<DeferredRoute><AdminUsersPage /></DeferredRoute>} />
            <Route path="users/:id" element={<DeferredRoute><AdminUserDetailPage /></DeferredRoute>} />
          </Route>
          <Route element={<StaffRoute permission="users.manage" />}>
            <Route path="roles" element={<DeferredRoute><AdminRolesPage /></DeferredRoute>} />
          </Route>
          <Route element={<StaffRoute permission="reports.view" />}>
            <Route path="reports" element={<DeferredRoute><AdminReportsPage /></DeferredRoute>} />
          </Route>
          <Route element={<StaffRoute permission="settings.manage" />}>
            <Route path="settings" element={<DeferredRoute><AdminSettingsPage /></DeferredRoute>} />
          </Route>
          <Route path="*" element={<AdminComingSoonPage title="Módulo no disponible" description="La ruta solicitada aún no forma parte de esta entrega." />} />
        </Route>
      </Route>
    </Routes>
  );
}
