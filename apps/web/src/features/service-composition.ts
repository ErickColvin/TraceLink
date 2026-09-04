import { runtimeConfig, type RuntimeConfig } from "../app/config/runtime";
import { HttpClient } from "../lib/http/http-client";
import type { AuthService } from "./auth/services/auth-service";
import { HttpAuthService } from "./auth/services/http-auth-service";
import { MockAuthService } from "./auth/services/mock-auth-service";
import type {
  CustomerSelfService,
  CustomerService,
  StaffCustomerService,
} from "./customers/services/customer-service";
import {
  HttpCustomerSelfService,
  HttpStaffCustomerService,
} from "./customers/services/http-customer-service";
import { MockCustomerService } from "./customers/services/mock-customer-service";
import type { DashboardService } from "./dashboard/services/dashboard-service";
import { HttpDashboardService } from "./dashboard/services/http-dashboard-service";
import { MockDashboardService } from "./dashboard/services/mock-dashboard-service";
import { HttpInventoryService } from "./inventory/services/http-inventory-service";
import type { InventoryService } from "./inventory/services/inventory-service";
import { MockInventoryService } from "./inventory/services/mock-inventory-service";
import { HttpOrderService } from "./orders/services/http-order-service";
import { HttpStaffOrderService } from "./orders/services/http-staff-order-service";
import { MockOrderService } from "./orders/services/mock-order-service";
import { MockStaffOrderService } from "./orders/services/mock-staff-order-service";
import type { OrderService } from "./orders/services/order-service";
import type { StaffOrderService } from "./orders/services/staff-order-service";
import { HttpPackageService } from "./packages/services/http-package-service";
import { HttpStaffPackageService } from "./packages/services/http-staff-package-service";
import { MockPackageService } from "./packages/services/mock-package-service";
import { MockStaffPackageService } from "./packages/services/mock-staff-package-service";
import type { PackageService } from "./packages/services/package-service";
import type { StaffPackageService } from "./packages/services/staff-package-service";
import { HttpProductService } from "./products/services/http-product-service";
import { MockProductService } from "./products/services/mock-product-service";
import type { ProductService } from "./products/services/product-service";
import { HttpReportService } from "./reports/services/http-report-service";
import { MockReportService } from "./reports/services/mock-report-service";
import type { ReportService } from "./reports/services/report-service";
import { HttpSettingsService } from "./settings/services/http-settings-service";
import { MockSettingsService } from "./settings/services/mock-settings-service";
import type { SettingsService } from "./settings/services/settings-service";
import { HttpRoleService } from "./users/services/http-role-service";
import { HttpUserService } from "./users/services/http-user-service";
import { MockRoleService } from "./users/services/mock-role-service";
import { MockUserService } from "./users/services/mock-user-service";
import type { RoleService } from "./users/services/role-service";
import type { UserService } from "./users/services/user-service";

export type ApplicationServices = Readonly<{
  authService: AuthService;
  customerSelfService: CustomerSelfService;
  customerService: CustomerService;
  dashboardService: DashboardService;
  inventoryService: InventoryService;
  orderService: OrderService;
  packageService: PackageService;
  productService: ProductService;
  reportService: ReportService;
  roleService: RoleService;
  settingsService: SettingsService;
  staffCustomerService: StaffCustomerService;
  staffOrderService: StaffOrderService;
  staffPackageService: StaffPackageService;
  userService: UserService;
}>;

export function createMockApplicationServices(): ApplicationServices {
  const inventoryService = new MockInventoryService();
  const productService = new MockProductService(
    undefined,
    (productId) => inventoryService.getAvailableStockByProductId(productId),
  );
  const customerService = new MockCustomerService();
  const orderService = new MockOrderService();
  const staffOrderService = new MockStaffOrderService();
  const packageService = new MockPackageService();
  const staffPackageService = new MockStaffPackageService();
  const settingsService = new MockSettingsService();

  return Object.freeze({
    authService: new MockAuthService(),
    customerSelfService: customerService,
    customerService,
    dashboardService: new MockDashboardService({
      inventoryService,
      staffOrderService,
      staffPackageService,
      settingsService,
    }),
    inventoryService,
    orderService,
    packageService,
    productService,
    reportService: new MockReportService(),
    roleService: new MockRoleService(),
    settingsService,
    staffCustomerService: customerService,
    staffOrderService,
    staffPackageService,
    userService: new MockUserService(),
  });
}

export function createHttpApplicationServices(
  client: HttpClient,
): ApplicationServices {
  const customerSelfService = new HttpCustomerSelfService(client);
  const staffCustomerService = new HttpStaffCustomerService(client);

  return Object.freeze({
    authService: new HttpAuthService(client),
    customerSelfService,
    customerService: {
      getCurrent: () => customerSelfService.getCurrent(),
      updateCurrent: (input) => customerSelfService.updateCurrent(input),
      list: (params) => staffCustomerService.list(params),
      getById: (id) => staffCustomerService.getById(id),
      update: (id, input) => staffCustomerService.update(id, input),
    },
    dashboardService: new HttpDashboardService(client),
    inventoryService: new HttpInventoryService(client),
    orderService: new HttpOrderService(client),
    packageService: new HttpPackageService(client),
    productService: new HttpProductService(client),
    reportService: new HttpReportService(client),
    roleService: new HttpRoleService(client),
    settingsService: new HttpSettingsService(client),
    staffCustomerService,
    staffOrderService: new HttpStaffOrderService(client),
    staffPackageService: new HttpStaffPackageService(client),
    userService: new HttpUserService(client),
  });
}

export function composeApplicationServices(
  config: RuntimeConfig,
): ApplicationServices {
  if (config.dataMode === "mock") return createMockApplicationServices();
  return createHttpApplicationServices(new HttpClient(config.apiBaseUrl));
}

export const applicationServices = composeApplicationServices(runtimeConfig);
