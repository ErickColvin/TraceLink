import {
  PERMISSIONS,
  ROLE_CODES,
  type Permission,
  type RoleCode,
} from "@tracelink/contracts";

export type RoleCatalogEntry = Readonly<{
  code: RoleCode;
  label: string;
  description: string;
  system: boolean;
  permissions: readonly Permission[];
}>;

const allPermissions = [...PERMISSIONS] satisfies Permission[];

export const ROLE_CATALOG = [
  {
    code: "SUPER_ADMIN",
    label: "Superadministración",
    description: "Control total del tenant y de su configuración de acceso.",
    system: true,
    permissions: allPermissions,
  },
  {
    code: "ADMIN",
    label: "Administración",
    description: "Administración operativa completa de CH Market.",
    system: true,
    permissions: allPermissions,
  },
  {
    code: "INVENTORY",
    label: "Inventario",
    description: "Catálogo, existencias, movimientos y reportes de inventario.",
    system: true,
    permissions: [
      "products.view",
      "inventory.view",
      "inventory.adjust",
      "reports.view",
    ],
  },
  {
    code: "OPERATIONS",
    label: "Operaciones",
    description: "Pedidos, recepción, trazabilidad y entrega de paquetes.",
    system: true,
    permissions: [
      "orders.view",
      "orders.update",
      "orders.cancel",
      "packages.view",
      "packages.receive",
      "packages.update",
      "packages.deliver",
      "customers.view",
    ],
  },
  {
    code: "SALES",
    label: "Ventas",
    description: "Consulta de productos, pedidos, clientes y reportes comerciales.",
    system: true,
    permissions: [
      "products.view",
      "orders.view",
      "orders.update",
      "customers.view",
      "customers.update",
      "reports.view",
    ],
  },
  {
    code: "WAREHOUSE",
    label: "Bodega",
    description: "Inventario físico y ciclo operativo de paquetes.",
    system: true,
    permissions: [
      "products.view",
      "inventory.view",
      "inventory.adjust",
      "packages.view",
      "packages.receive",
      "packages.update",
      "packages.deliver",
    ],
  },
] as const satisfies readonly RoleCatalogEntry[];

export function getRoleCatalogEntry(code: RoleCode): RoleCatalogEntry {
  const role = ROLE_CATALOG.find((candidate) => candidate.code === code);
  if (role === undefined) {
    throw new Error(`Role catalog is incomplete for ${code}.`);
  }
  return role;
}

export function assertRbacCatalog(): void {
  const knownPermissions = new Set<string>(PERMISSIONS);
  const roleCodes = new Set(ROLE_CATALOG.map((role) => role.code));

  if (roleCodes.size !== ROLE_CODES.length) {
    throw new Error("RBAC catalog must define every role exactly once.");
  }
  for (const code of ROLE_CODES) {
    if (!roleCodes.has(code)) {
      throw new Error(`RBAC catalog is missing role ${code}.`);
    }
  }
  for (const role of ROLE_CATALOG) {
    if (new Set(role.permissions).size !== role.permissions.length) {
      throw new Error(`Role ${role.code} contains duplicate permissions.`);
    }
    for (const permission of role.permissions) {
      if (!knownPermissions.has(permission)) {
        throw new Error(`Role ${role.code} has unknown permission ${permission}.`);
      }
    }
  }
}

