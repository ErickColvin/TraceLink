# Arquitectura de TraceLink V2

## 1. Producto y estado

TraceLink V2 es la plataforma de comercio, inventario, pedidos y trazabilidad desarrollada por Colvin Solutions. CH Market es la primera organización.

La entrega incluye tres experiencias React:

1. tienda pública;
2. portal autenticado de cliente;
3. portal autenticado de personal/administración.

Fase 2 cerró la experiencia frontend. Fase 3 incorpora API autoritativa, PostgreSQL, autenticación real, RBAC e integración HTTP sin reconstruir la UI. El modo mock sigue disponible para desarrollo y tests aislados.

## 2. Principios

- Integridad y seguridad se validan en servidor; los permisos frontend son UX.
- Customer solo consulta recursos ligados a su identidad autenticada.
- Toda entidad de negocio pertenece a Organization.
- Los importes CLP son enteros.
- Las pantallas consumen interfaces de servicio, nunca fixtures ni `fetch` directo.
- Los DTO HTTP y modelos de base son fronteras distintas.
- Las mutaciones críticas son transaccionales, auditables e idempotentes.
- Se prefieren cambios modulares y dependencias justificadas.

## 3. Flujo de aplicación

```text
Page
  -> feature hook / use case
  -> service interface
     -> Mock adapter
     -> HTTP adapter
        -> shared HttpClient
        -> Express route / middleware
        -> controller
        -> domain service
        -> tenant-scoped repository
        -> PostgreSQL 18
```

La raíz de composición selecciona `mock` o `http` una sola vez mediante `VITE_DATA_MODE`. Las pantallas no conocen el adapter activo.

## 4. Stack

### Frontend

- React 19 y TypeScript estricto;
- Vite, React Router y Tailwind CSS;
- TanStack Query;
- React Hook Form + Zod;
- Vitest + React Testing Library;
- Playwright Core para recorridos de navegador.

### Backend

- Node.js 24 LTS y TypeScript estricto;
- Express 5 + Zod;
- PostgreSQL 18;
- Prisma 8 fijado por versión para contrato/migraciones;
- Argon2id;
- Pino, Helmet y CORS exacto;
- Vitest + Supertest + PostgreSQL embebido en integración/E2E.

## 5. Monorepo

```text
TraceLink/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       ├── features/
│   │       ├── layouts/
│   │       ├── lib/
│   │       └── styles/
│   └── api/
│       ├── migrations/
│       ├── prisma/
│       ├── src/
│       │   ├── config/
│       │   ├── database/
│       │   ├── middleware/
│       │   ├── modules/
│       │   └── shared/
│       └── tests/
├── packages/
│   └── contracts/
├── docs/
├── tests/e2e/
└── docker-compose.yml
```

`packages/contracts` contiene schemas Zod de API para auth, errores, paginación, productos, inventario, pedidos, paquetes, clientes, usuarios, roles, dashboard, reportes y settings. El frontend nunca importa tipos Prisma.

## 6. Superficies web

### Públicas

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
/app/dashboard
/app/products
/app/products/new
/app/products/:id
/app/products/:id/edit
/app/inventory
/app/inventory/movements
/app/orders
/app/orders/:id
/app/packages
/app/packages/new
/app/packages/:id
/app/customers
/app/customers/:id
/app/users
/app/users/:id
/app/roles
/app/reports
/app/settings
```

El checkout sigue siendo una simulación explícita; no reserva stock ni procesa pagos.

## 7. Estado y datos frontend

TanStack Query administra estado con semántica de servidor e invalidación. React conserva estado local de UI y carrito. No existe un store global para toda la aplicación.

Cada feature expone un contrato, queries y adapters. Los 14 adapters HTTP implementan las mismas interfaces que sus equivalentes mock. El HttpClient centraliza URL base, cookies, CSRF en memoria, JSON, request IDs, Zod, errores e idempotencia.

## 8. Identidad y autorización

Se distinguen:

- `User`: identidad global y password Argon2id;
- `Customer`: perfil comercial en una Organization;
- `Membership`: acceso staff a una Organization;
- `Role`/`Permission`: autorización de la Membership.

La sesión es server-side. El navegador recibe un token opaco aleatorio en cookie HttpOnly; PostgreSQL conserva solo su HMAC. En producción la cookie usa prefijo `__Host-`, `Secure`, `SameSite=Lax`, `Path=/` y sin Domain.

Las mutaciones autenticadas necesitan token CSRF ligado a sesión y Origin exacto. La API reconstruye permisos en cada request y revoca sesiones al deshabilitar acceso.

## 9. Multi-tenancy y ownership

La organización nunca se acepta desde body/query como autoridad. Rutas públicas resuelven el slug configurado; rutas privadas obtienen tenant y actor desde Session.

Repositories exigen `organizationId`, filtran todas las entidades privadas y usan joins/foreign keys compuestos. Las rutas `/me` añaden el `customerId` de sesión a la misma consulta. Fuera de alcance e inexistente son indistinguibles mediante `404`.

## 10. Persistencia operativa

### Catálogo y clientes

Category, Product y Customer son tenant-scoped. SKU, slug y barcode son únicos dentro de la organización. El contacto de Customer no altera las credenciales de User.

### Inventario

InventoryBalance materializa físico/reservado; disponible se deriva. Todo ajuste físico produce InventoryMovement inmutable dentro de una transacción con bloqueo, invariantes de cantidades y AuditLog. InventoryReservation está persistido y probado, pero su uso por checkout corresponde a Fase 4.

### Pedidos

Order conserva montos CLP e items snapshot. La máquina de estados del servidor produce OrderStatusEvent y AuditLog atómicamente. Customer y staff leen la misma fila.

### Paquetes

Package y TrackingEvent implementan recepción, almacenamiento, disponibilidad, entrega y excepciones. La entrega valida un código almacenado solo como HMAC, lo consume y crea PackagePickupReceipt. Customer y staff leen la misma fila.

### Administración y lectura

OrganizationSettings es la fuente de configuración. Dashboard y ReportService agregan información persistida; no almacenan KPIs como verdad primaria.

## 11. Seguridad transversal

- Zod valida entrada y salida en fronteras.
- Helmet y tamaño JSON acotado reducen superficie HTTP.
- CORS y Origin permiten solo el frontend configurado.
- Rate limits persistentes protegen auth y entrega.
- IdempotencyRecord evita duplicar efectos críticos.
- AuditLog registra actor, tenant, entidad y request ID sin secretos.
- Errores normalizados no exponen stack en producción.
- Logging estructurado redacta cookies, autorización, passwords, sesión, CSRF y pickup code.

Los detalles y el checklist de despliegue están en [docs/security.md](docs/security.md).

## 12. Transacciones y base de datos

Los límites transaccionales, constraints, índices, modelos y migraciones se documentan en:

- [docs/backend-architecture.md](docs/backend-architecture.md)
- [docs/database-model.md](docs/database-model.md)

El endpoint estable se documenta en [docs/api.md](docs/api.md) y el vínculo con contratos frontend en [docs/api-contract-map.md](docs/api-contract-map.md).

## 13. Calidad

Las suites cubren:

- reglas puras y contratos;
- API con Supertest;
- repositories y flujos contra PostgreSQL real;
- auth, CSRF, RBAC, tenant y customer ownership;
- transacciones, state machines, auditoría e idempotencia;
- adapters HTTP y modo mock;
- E2E browser con frontend HTTP, API y PostgreSQL.

Los gates de cierre son `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm test:e2e`.

## 14. Fuera de Fase 3

- pago real, conciliación y webhooks;
- reserva desde checkout y confirmación autoritativa de compra;
- correo, SMS, WhatsApp y courier APIs;
- uploads/almacenamiento de imágenes;
- recuperación de contraseña;
- Redis, colas, microservicios, Kubernetes, GraphQL, BI avanzado, IA o apps nativas.

Estas capacidades requieren contratos de producto y seguridad propios; no se simulan silenciosamente.
