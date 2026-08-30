# ARCHITECTURE.md

## 1. Product
TraceLink V2 is a digital operations platform developed by Colvin Solutions.

The first implementation is for CH Market.

The web application will contain three experiences:

### Public storefront
- Home
- Product catalog
- Product detail
- About / information
- Contact
- Login
- Local demonstration cart; future checkout
- Entry point for customer order/package visibility

### Customer portal
- Login
- Profile
- My orders
- Order detail
- My packages
- Package detail
- Traceability timeline
- Future online purchasing/history

### Staff/admin portal
- Dashboard
- Products
- Inventory
- Orders
- Packages
- Customers
- Users
- Roles/permissions
- Reports
- Settings

Current milestone: frontend-first.

The frontend must be production-quality in structure while initially using mock data.

## 2. Product principles

### Public experience
The CH Market public site must look like a modern commercial storefront.

Primary goals:
- present CH Market professionally;
- make products easy to discover;
- make login visible;
- prepare the UX for ecommerce;
- make tracking/order access clear.

### Customer experience
Customers may only see their own records.
Do not design any flow where entering a person's name exposes orders or packages.

### Staff experience
The admin interface prioritizes operational speed, clarity and visibility.

## 3. Architectural style
Use a modular feature-based React application.

Conceptually:

```text
UI
 |
 v
Feature hooks / use-cases
 |
 v
Service interfaces
 |
 +----------------------+
 |                      |
Mock adapters       HTTP adapters
(current)           (future)
```

The UI must not import mock fixtures directly.

## 4. Technology baseline
- React
- TypeScript strict
- Vite
- pnpm
- React Router
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod
- Vitest
- React Testing Library
- Playwright later

## 5. Repository target structure

```text
tracelink/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── catalog/
│       │   │   ├── cart/
│       │   │   ├── customers/
│       │   │   ├── inventory/
│       │   │   ├── orders/
│       │   │   ├── packages/
│       │   │   ├── products/
│       │   │   └── users/
│       │   ├── layouts/
│       │   ├── lib/
│       │   ├── routes/
│       │   └── styles/
│       └── package.json
├── docs/
├── AGENTS.md
├── ARCHITECTURE.md
├── package.json
└── pnpm-workspace.yaml
```

## 6. Route map

### Public
```text
/
/productos
/productos/:slug
/nosotros
/contacto
/login
/registro
/carrito
/checkout
```

### Customer
```text
/mi-cuenta
/mi-cuenta/pedidos
/mi-cuenta/pedidos/:id
/mi-cuenta/paquetes
/mi-cuenta/paquetes/:id
/mi-cuenta/perfil
```

### Staff/admin
```text
/app
/app/dashboard
/app/products
/app/products/:id
/app/inventory
/app/inventory/movements
/app/orders
/app/orders/:id
/app/packages
/app/packages/:id
/app/customers
/app/customers/:id
/app/users
/app/roles
/app/reports
/app/settings
```

## 7. Domain models needed by the frontend

### Product
```ts
type Product = {
  id: string
  sku: string
  barcode?: string
  slug: string
  name: string
  description?: string
  brand?: string
  categoryId: string
  salePrice: number
  imageUrl?: string
  availableStock: number
  minimumStock?: number
  published: boolean
  active: boolean
}
```

### Customer
```ts
type Customer = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}
```

### Order
Use explicit statuses such as:
- PENDING_PAYMENT
- PAID
- PREPARING
- READY
- COMPLETED
- CANCELLED
- REFUNDED

### Package
Use explicit statuses such as:
- EXPECTED
- RECEIVED
- STORED
- READY_FOR_PICKUP
- PICKED_UP
- RETURNED
- LOST
- INCIDENT

### TrackingEvent
Every package status change must be representable as an event in the UI timeline.

## 8. Data layer

Each feature exposes a service contract.

Example:

```ts
export interface ProductService {
  list(params?: ProductListParams): Promise<ProductPage>
  getById(id: string): Promise<Product>
  getBySlug(slug: string): Promise<Product>
}
```

During frontend-first development:

```text
ProductService
      |
      v
MockProductService
```

Later:

```text
ProductService
      |
      v
HttpProductService
      |
      v
/api/v1/products
```

Screens must not know which adapter is active.

## 9. State management

Use:
- TanStack Query for server-like state;
- React state for local view state;
- a small store only when cross-page client state is truly necessary, e.g. cart.

Do not use a global store for all application data.

## 10. Authentication model

Frontend models:
- anonymous visitor;
- authenticated customer;
- authenticated staff member.

Route guards:
- `PublicRoute`
- `CustomerRoute`
- `StaffRoute`
- permission-aware admin navigation

Future backend authentication is authoritative.

Do not use localStorage as the long-term security model for authentication tokens.

## 11. Permissions

Example permission keys:

```text
products.view
products.create
products.update
products.delete

inventory.view
inventory.adjust

orders.view
orders.update
orders.cancel

packages.view
packages.receive
packages.update
packages.deliver

customers.view
customers.update

users.view
users.manage

reports.view
settings.manage
```

The frontend may hide/disable unauthorized operations.
The backend must later re-check all permissions.

## 12. Branding

CH Market branding must live in centralized configuration/tokens.

Example:

```ts
export const tenantBrand = {
  name: "CH Market",
  shortName: "CH",
  locale: "es-CL",
  currency: "CLP",
  timezone: "America/Santiago",
}
```

Do not hard-code brand strings in dozens of components.

## 13. Frontend phases

### F1 — Foundation
- Vite + React + TS
- Tailwind
- router
- query provider
- theme
- layouts
- mock service layer
- base responsive components

### F2 — Public CH Market
- navbar
- hero
- categories
- featured products
- product catalog
- product detail
- footer
- contact
- login screen

### F3 — Customer portal
- account shell
- orders list/detail
- packages list/detail
- traceability timeline
- profile

### F4 — Admin shell
- sidebar/topbar
- dashboard
- permission-aware navigation

### F5 — Operations UI
- products
- inventory
- packages
- orders
- customers
- users/roles

### F6 — Ecommerce
- cart persistence and authoritative stock reconciliation
- checkout UI
- stock reservation UX
- payment status UX

### F7 — Backend integration
Replace mock adapters with HTTP adapters without changing page structure.

## 14. Non-goals for the current milestone
Do not implement yet unless explicitly requested:
- microservices,
- Kubernetes,
- GraphQL,
- native mobile apps,
- AI features,
- courier integrations,
- complex BI,
- backend authorization,
- payment processing.

## 15. Quality bar
Every public/customer page must be responsive.

Every async screen must define:
- loading,
- error,
- empty,
- normal state.

Critical interactions need success/error feedback.

UI must remain usable with keyboard navigation.

## 16. First implementation target
The first visible release should include:

1. Public Home.
2. Product catalog.
3. Product detail.
4. Login.
5. Customer portal shell.
6. My orders.
7. My packages.
8. Package timeline.
9. Admin shell.
10. Basic dashboard.

All data can initially come from typed mock adapters.
