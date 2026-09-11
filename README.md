# TraceLink V2 · CH Market

TraceLink V2 es la plataforma de comercio, inventario, pedidos y trazabilidad de Colvin Solutions. Esta entrega integra la UI completa de CH Market con una API autoritativa, sesiones server-side, PostgreSQL, checkout real con reservas y una abstracción de pagos, manteniendo un modo mock local.

## Estado

Fase 4 incluye:

- storefront responsive, carrito y checkout autenticado;
- portales customer y staff con la UX de Fase 2 intacta;
- API Express 5 modular bajo `/api/v1`;
- PostgreSQL 18 y modelos tenant-scoped para comercio, inventario, pedidos, paquetes y pagos;
- contrato Prisma 8 y migraciones versionadas;
- auth con Argon2id, cookie HttpOnly, sesión revocable y CSRF;
- seis roles, permisos tipados y enforcement en servidor, incluyendo `orders.refund`;
- productos, clientes, inventario transaccional, reservas de checkout, pedidos, pagos y paquetes persistidos;
- checkout autoritativo: precios/stock calculados en backend, order `PENDING_PAYMENT`, reserva de 15 minutos configurable y redirección a `checkoutUrl`;
- `PaymentProvider` con provider fake para CI y adapter Mercado Pago Orders API para sandbox;
- webhook firmado `/api/v1/webhooks/mercadopago`, reconciliación contra provider e idempotencia ante duplicados;
- reintento de pago sobre la misma order, cancelación customer de pedidos pendientes y full refund staff;
- cumplimiento de pedidos pagados que consume inventario reservado una sola vez;
- registro público customer en `/registro`;
- AuditLog, request IDs, idempotencia y rate limits persistentes;
- dashboard/reportes derivados de PostgreSQL;
- adapters HTTP con validación Zod y modo mock intercambiable;
- tests unitarios, API, integración PostgreSQL, seguridad y E2E browser real.

## Requisitos

- Node.js 24 LTS (`>=24`).
- Corepack y pnpm 11.24.0.
- Docker Desktop/Engine para la base de desarrollo.
- Chrome, Microsoft Edge o Chromium para E2E/revisión visual. Si no está en una ruta estándar, define `CHROME_PATH`.

Comprueba las versiones:

```powershell
node --version
corepack pnpm --version
docker compose version
```

## Primera instalación en modo HTTP

Desde la carpeta `TraceLink`:

```powershell
corepack pnpm install
Copy-Item .env.example .env
```

Edita `.env` antes de continuar:

- usa una contraseña PostgreSQL exclusivamente local;
- genera valores independientes de al menos 32 bytes para `SESSION_SECRET`, `CSRF_SECRET`, `IDEMPOTENCY_SECRET`, `RATE_LIMIT_SECRET` y `PICKUP_CODE_SECRET`;
- define email/password locales para las identidades seed;
- deja `VITE_DATA_MODE=http`.

Puedes generar cada secreto con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Levanta PostgreSQL, aplica la cadena y carga datos coherentes:

```powershell
corepack pnpm db:up
corepack pnpm db:migrate
corepack pnpm db:seed

# Expirar reservas de checkout vencidas de forma idempotente
corepack pnpm reservations:expire
```

El seed es idempotente. Usa las variables `SEED_ADMIN_*`, `SEED_STAFF_*`, `SEED_CUSTOMER_*` y `SEED_PACKAGE_PICKUP_CODE`; no contiene una contraseña productiva en el código. Requiere `NODE_ENV=development|test`, rechaza producción y los placeholders de `.env.example` antes de abrir una conexión.

Inicia frontend y API:

```powershell
corepack pnpm dev
```

Abre:

- web: `http://127.0.0.1:5173`;
- API: `http://127.0.0.1:3001/api/v1`;
- salud: `http://127.0.0.1:3001/api/v1/health`;
- readiness DB: `http://127.0.0.1:3001/api/v1/health/ready`.

En modo HTTP, inicia sesión con los valores de email/password que configuraste para el seed. Los accesos demo se ocultan.

## Inicio rápido en modo mock

Para recorrer solamente el frontend sin Docker/API, define en `.env`:

```text
VITE_DATA_MODE=mock
```

Luego:

```powershell
corepack pnpm dev:web
```

En `/login` aparecerán “Entrar como cliente” y “Entrar como personal”. Los datos y mutaciones mock viven en memoria y se reinician al recargar.

## Comandos de desarrollo

```powershell
# Frontend + API
corepack pnpm dev

# Solo una aplicación
corepack pnpm dev:web
corepack pnpm dev:api

# Compilar y previsualizar frontend compilado
corepack pnpm build
corepack pnpm preview
```

Vite proxyea `/api` a `VITE_API_PROXY_TARGET`, por defecto `http://127.0.0.1:3001`, para aproximar same-origin en desarrollo.

## Comandos de base de datos

```powershell
# Contenedor PostgreSQL 18 persistente de desarrollo
corepack pnpm db:up
corepack pnpm db:down

# PostgreSQL separado del perfil de tests manual
corepack pnpm db:test:up

# Contrato y migraciones Prisma 8
corepack pnpm db:contract
corepack pnpm db:plan
corepack pnpm db:migrate
corepack pnpm db:verify
corepack pnpm db:migration:check

# Dataset de desarrollo idempotente
corepack pnpm db:seed
```

`db:down` detiene los servicios y conserva el volumen de desarrollo. Ningún script de este proyecto hace reset o drop automático de una base productiva.

## Calidad y pruebas

Gates completos:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

Suites backend por separado:

```powershell
corepack pnpm test:unit
corepack pnpm test:api
corepack pnpm test:integration
```

`test:integration` y `test:e2e` levantan un PostgreSQL 18 embebido y aislado. El E2E aplica migraciones, carga fixtures, inicia API y Vite en modo HTTP, ejecuta Chrome/Edge y libera los procesos; no requiere dejar servidores abiertos.

Revisión responsive del modo mock con Vite ya iniciado:

```powershell
corepack pnpm dev:web
# En otra terminal:
corepack pnpm review:visual
```

La revisión genera 29 capturas temporales y verifica 375, 768, 1024 y 1440 px, overflow, errores de página, foco/drawer y el flujo de paquete.

## Modos de datos

| Variable | Resultado |
| --- | --- |
| `VITE_DATA_MODE=mock` | Adapters en memoria y accesos demo. |
| `VITE_DATA_MODE=http` | Adapters HTTP, cookie de sesión real y PostgreSQL autoritativo. |

La selección ocurre en `apps/web/src/features/service-composition.ts`; no hay condicionales de modo dispersos por las pantallas.

## Rutas principales

### Tienda pública

```text
/
/productos
/productos/:slug
/nosotros
/contacto
/carrito
/checkout
/checkout/resultado
/login
/registro
```

`/checkout` requiere sesión customer. La URL de retorno `/checkout/resultado` es solo UX: no aprueba pedidos desde query params; el estado real queda en API/PostgreSQL y se actualiza por webhook/reconciliación.

### Portal customer

```text
/mi-cuenta
/mi-cuenta/pedidos
/mi-cuenta/pedidos/:id
/mi-cuenta/paquetes
/mi-cuenta/paquetes/:id
/mi-cuenta/perfil
```

### Portal staff

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

## Arquitectura resumida

```text
React page
  -> feature service interface
  -> mock adapter o HTTP adapter
  -> shared HttpClient
  -> Express middleware/controller/service/repository
  -> PostgreSQL
```

- `apps/web/src/app`: router, providers y configuración runtime.
- `apps/web/src/features`: dominio, queries, contratos y adapters.
- `apps/web/src/lib/http`: cliente HTTP reutilizable.
- `apps/api/src/modules`: módulos de negocio por capas.
- `apps/api/src/modules/checkout`: creación autoritativa de order, reserva y payment attempt.
- `apps/api/src/modules/payments`: providers, webhooks, retry, refund y reconciliación.
- `apps/api/src/middleware` y `shared`: seguridad y comportamiento transversal.
- `packages/contracts`: DTOs Zod compartidos.

## Seguridad operativa

- Nunca subas `.env`, credenciales, cookies ni tokens.
- El tenant, actor y ownership se derivan de Session; no se aceptan como autoridad desde el navegador.
- La cookie de producción es `__Host-`, HttpOnly, Secure, SameSite=Lax, Path=/ y sin Domain.
- CSRF y Origin exacto protegen mutaciones autenticadas.
- Passwords usan Argon2id; tokens/códigos se guardan únicamente como hashes.
- Rate limits protegen auth y entrega; AuditLog omite secretos.
- IDs fuera de tenant/customer responden `404` sin revelar existencia.
- El navegador no envía precios, customerId ni estado de pago como autoridad.
- Webhooks de pago inválidos no aplican efectos de negocio.
- `TRUST_PROXY` debe coincidir con la topología real y el origen de API no debe quedar accesible saltándose el proxy autorizado.

Consulta [docs/security.md](docs/security.md) antes de desplegar.

## Documentación

- [ARCHITECTURE.md](ARCHITECTURE.md): arquitectura vigente y límites.
- [docs/backend-architecture.md](docs/backend-architecture.md): capas y transacciones.
- [docs/api.md](docs/api.md): endpoints HTTP estables.
- [docs/api-contract-map.md](docs/api-contract-map.md): equivalencia de los 14 servicios frontend.
- [docs/database-model.md](docs/database-model.md): modelos, relaciones, índices y migraciones.
- [docs/security.md](docs/security.md): controles y checklist de despliegue.
- [docs/ecommerce.md](docs/ecommerce.md): reglas de checkout, orders, fulfillment, cancelación y refund.
- [docs/inventory-reservations.md](docs/inventory-reservations.md): ciclo de vida de reservas y consumo.
- [docs/payments.md](docs/payments.md): arquitectura de pagos y Mercado Pago Orders API.
- [docs/payment-webhooks.md](docs/payment-webhooks.md): firma, deduplicación y reconciliación.
- [docs/frontend-design.md](docs/frontend-design.md): sistema visual y patrones UX.
- [docs/frontend-roadmap.md](docs/frontend-roadmap.md): fases terminadas y siguientes.
- [docs/ui-review-phase-3.md](docs/ui-review-phase-3.md): revisión visual y mejoras posibles.
- [FinFase 2.txt](FinFase%202.txt): informe de cierre anterior.
- `FinFase 3.txt`: informe integral generado al cerrar esta fase.
- [FinFase 4.txt](FinFase%204.txt): informe integral generado al cerrar Fase 4.
- [QUE HACER.txt](QUE%20HACER.txt): pasos locales y datos necesarios para preparar la siguiente fase.
