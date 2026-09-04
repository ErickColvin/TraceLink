import {
  PERMISSIONS,
  type Permission,
} from "@/features/auth/model/auth";

import type { StaffRoleDefinition } from "../domain";

const permissions = (...items: Permission[]): Permission[] => [...items];

export const mockStaffRoles: readonly StaffRoleDefinition[] = [
  { id: "role-super-admin", code: "SUPER_ADMIN", label: "Superadministración", description: "Control completo de la operación y configuración.", permissions: [...PERMISSIONS], system: true },
  { id: "role-admin", code: "ADMIN", label: "Administración", description: "Gestión comercial y operativa sin control total de plataforma.", permissions: permissions("products.view", "products.create", "products.update", "inventory.view", "inventory.adjust", "orders.view", "orders.update", "orders.cancel", "packages.view", "packages.receive", "packages.update", "packages.deliver", "customers.view", "customers.update", "users.view", "reports.view"), system: true },
  { id: "role-inventory", code: "INVENTORY", label: "Inventario", description: "Productos, existencias, lotes y movimientos.", permissions: permissions("products.view", "inventory.view", "inventory.adjust", "reports.view"), system: true },
  { id: "role-operations", code: "OPERATIONS", label: "Operaciones", description: "Pedidos, paquetes y atención de clientes.", permissions: permissions("orders.view", "orders.update", "orders.cancel", "packages.view", "packages.receive", "packages.update", "packages.deliver", "customers.view", "customers.update"), system: true },
  { id: "role-sales", code: "SALES", label: "Ventas", description: "Catálogo, pedidos y clientes para soporte comercial.", permissions: permissions("products.view", "orders.view", "orders.update", "customers.view", "customers.update", "reports.view"), system: true },
  { id: "role-warehouse", code: "WAREHOUSE", label: "Bodega", description: "Recepción, custodia, inventario y entrega de paquetes.", permissions: permissions("products.view", "inventory.view", "inventory.adjust", "packages.view", "packages.receive", "packages.update", "packages.deliver"), system: true },
];
