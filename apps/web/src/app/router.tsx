import { lazy, Suspense, type PropsWithChildren } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { CustomerRoute } from "@/features/auth/routes/customer-route";
import { StaffRoute } from "@/features/auth/routes/staff-route";

const PublicLayout = lazy(() =>
  import("@/layouts/public-layout").then((module) => ({ default: module.PublicLayout })),
);
const CustomerLayout = lazy(() =>
  import("@/layouts/customer-layout").then((module) => ({ default: module.CustomerLayout })),
);
const AdminLayout = lazy(() =>
  import("@/layouts/admin-layout").then((module) => ({ default: module.AdminLayout })),
);
const HomePage = lazy(() =>
  import("@/features/products/pages/home-page").then((module) => ({ default: module.HomePage })),
);
const CatalogPage = lazy(() =>
  import("@/features/products/pages/catalog-page").then((module) => ({ default: module.CatalogPage })),
);
const ProductDetailPage = lazy(() =>
  import("@/features/products/pages/product-detail-page").then((module) => ({ default: module.ProductDetailPage })),
);
const CartPage = lazy(() =>
  import("@/features/cart/cart-page").then((module) => ({ default: module.CartPage })),
);
const AboutPage = lazy(() =>
  import("@/features/content/pages/about-page").then((module) => ({ default: module.AboutPage })),
);
const ContactPage = lazy(() =>
  import("@/features/content/pages/contact-page").then((module) => ({ default: module.ContactPage })),
);
const NotFoundPage = lazy(() =>
  import("@/features/content/pages/not-found-page").then((module) => ({ default: module.NotFoundPage })),
);
const TermsPage = lazy(() =>
  import("@/features/content/pages/legal-placeholder-pages").then((module) => ({ default: module.TermsPage })),
);
const PrivacyPage = lazy(() =>
  import("@/features/content/pages/legal-placeholder-pages").then((module) => ({ default: module.PrivacyPage })),
);
const ReturnsPage = lazy(() =>
  import("@/features/content/pages/legal-placeholder-pages").then((module) => ({ default: module.ReturnsPage })),
);
const LoginPage = lazy(() =>
  import("@/features/auth/pages/login-page").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("@/features/auth/pages/register-page").then((module) => ({ default: module.RegisterPage })),
);
const CustomerHomePage = lazy(() =>
  import("@/features/customers/pages/customer-home-page").then((module) => ({ default: module.CustomerHomePage })),
);
const CustomerProfilePage = lazy(() =>
  import("@/features/customers/pages/customer-profile-page").then((module) => ({ default: module.CustomerProfilePage })),
);
const CustomerOrdersPage = lazy(() =>
  import("@/features/orders/pages/customer-orders-page").then((module) => ({ default: module.CustomerOrdersPage })),
);
const CustomerOrderDetailPage = lazy(() =>
  import("@/features/orders/pages/customer-order-detail-page").then((module) => ({ default: module.CustomerOrderDetailPage })),
);
const CustomerPackagesPage = lazy(() =>
  import("@/features/packages/pages/customer-packages-page").then((module) => ({ default: module.CustomerPackagesPage })),
);
const CustomerPackageDetailPage = lazy(() =>
  import("@/features/packages/pages/customer-package-detail-page").then((module) => ({ default: module.CustomerPackageDetailPage })),
);
const AdminComingSoonPage = lazy(() =>
  import("@/features/dashboard/pages/admin-coming-soon-page").then((module) => ({ default: module.AdminComingSoonPage })),
);

const CheckoutPage = lazy(() =>
  import("@/features/checkout/pages/checkout-page").then((module) => ({ default: module.CheckoutPage })),
);
const CheckoutResultPage = lazy(() =>
  import("@/features/checkout/pages/checkout-result-page").then((module) => ({ default: module.CheckoutResultPage })),
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
      <Route element={<DeferredRoute><PublicLayout /></DeferredRoute>}>
        <Route index element={<DeferredRoute><HomePage /></DeferredRoute>} />
        <Route path="productos" element={<DeferredRoute><CatalogPage /></DeferredRoute>} />
        <Route path="productos/:slug" element={<DeferredRoute><ProductDetailPage /></DeferredRoute>} />
        <Route path="nosotros" element={<DeferredRoute><AboutPage /></DeferredRoute>} />
        <Route path="contacto" element={<DeferredRoute><ContactPage /></DeferredRoute>} />
        <Route path="terminos" element={<DeferredRoute><TermsPage /></DeferredRoute>} />
        <Route path="privacidad" element={<DeferredRoute><PrivacyPage /></DeferredRoute>} />
        <Route path="cambios-y-devoluciones" element={<DeferredRoute><ReturnsPage /></DeferredRoute>} />
        <Route path="carrito" element={<DeferredRoute><CartPage /></DeferredRoute>} />
        <Route path="checkout" element={<CustomerRoute><DeferredRoute><CheckoutPage /></DeferredRoute></CustomerRoute>} />
        <Route path="checkout/resultado" element={<CustomerRoute><DeferredRoute><CheckoutResultPage /></DeferredRoute></CustomerRoute>} />
        <Route path="registro" element={<DeferredRoute><RegisterPage /></DeferredRoute>} />
        <Route path="*" element={<DeferredRoute><NotFoundPage /></DeferredRoute>} />
      </Route>

      <Route path="login" element={<DeferredRoute><LoginPage /></DeferredRoute>} />

      <Route element={<CustomerRoute />}>
        <Route path="mi-cuenta" element={<DeferredRoute><CustomerLayout /></DeferredRoute>}>
          <Route index element={<DeferredRoute><CustomerHomePage /></DeferredRoute>} />
          <Route path="pedidos" element={<DeferredRoute><CustomerOrdersPage /></DeferredRoute>} />
          <Route path="pedidos/:id" element={<DeferredRoute><CustomerOrderDetailPage /></DeferredRoute>} />
          <Route path="paquetes" element={<DeferredRoute><CustomerPackagesPage /></DeferredRoute>} />
          <Route path="paquetes/:id" element={<DeferredRoute><CustomerPackageDetailPage /></DeferredRoute>} />
          <Route path="perfil" element={<DeferredRoute><CustomerProfilePage /></DeferredRoute>} />
        </Route>
      </Route>

      <Route element={<StaffRoute />}>
        <Route path="app" element={<DeferredRoute><AdminLayout /></DeferredRoute>}>
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
