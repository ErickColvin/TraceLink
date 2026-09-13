# Deployment de TraceLink V2

## Estado verificable

La configuración del repositorio está preparada para Cloudflare Pages, Railway y GitHub Actions. La auditoría Fase 5B del 12 de septiembre de 2026 confirmó mediante la API pública de GitHub: 0 environments, 0 Actions runs y 0 PR abiertas. Tampoco existen URLs ni credenciales de proveedor disponibles en este proceso, por lo que el despliegue externo permanece **BLOCKED — MANUAL OWNER ACTION REQUIRED**.

No se han activado credenciales LIVE de Mercado Pago.

## Arquitectura

```text
GitHub PR / main
  -> GitHub Actions CI
  -> Railway Config plan/apply
     -> Railway PostgreSQL
     -> tracelink-api
     -> reservation-expiry cron
     -> payment-reconciliation cron
     -> notification-outbox cron
  -> Cloudflare Pages
     -> React SPA
```

Staging y production son environments independientes. No deben compartir base, secretos, tokens de proveedores ni remitentes.

## Entornos

| Entorno | Web | API/DB | Pago | Email |
| --- | --- | --- | --- | --- |
| local | Vite | PostgreSQL local | fake | fake |
| staging inicial | Cloudflare Pages preview | Railway staging | fake | fake |
| staging después del gate base | misma URL | misma API/DB | Mercado Pago TEST | Resend de prueba |
| production | Cloudflare Pages main | Railway production | fake hasta gate LIVE | fake hasta verificar dominio |

`APP_ENV` selecciona el entorno. Fuera de local, `NODE_ENV=production`, `WEB_ORIGIN` y `API_PUBLIC_URL` HTTPS son obligatorios.

## Cloudflare Pages

- directorio de aplicación: `apps/web` dentro del monorepo;
- comando reproducible: `corepack pnpm install --frozen-lockfile` y `corepack pnpm --filter @tracelink/web build`;
- output: `apps/web/dist`;
- Node: 24;
- frontend: `VITE_DATA_MODE=http` y `VITE_API_BASE_URL` apuntando a `/api/v1` de Railway;
- SPA fallback: `apps/web/public/_redirects`;
- headers: `apps/web/public/_headers`;
- deploy staging: `.github/workflows/deploy-staging.yml`;
- deploy production: `.github/workflows/deploy-production.yml`, manual y protegido por GitHub Environment.

Variables GitHub/Cloudflare, solo nombres:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PAGES_PROJECT
STAGING_API_BASE_URL
STAGING_WEB_URL
STAGING_API_URL
PRODUCTION_API_BASE_URL
PRODUCTION_WEB_URL
PRODUCTION_API_URL
```

El token de Cloudflare debe limitarse al proyecto/cuenta necesarios.

Ubicación requerida:

| Scope | Secrets | Variables |
| --- | --- | --- |
| GitHub Environment `staging` | `RAILWAY_STAGING_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_PAGES_PROJECT`, `STAGING_API_BASE_URL`, `STAGING_WEB_URL`, `STAGING_API_URL` |
| GitHub Environment `production` | `RAILWAY_PRODUCTION_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `RAILWAY_PROJECT_ID`, `CLOUDFLARE_PAGES_PROJECT`, `PRODUCTION_API_BASE_URL`, `PRODUCTION_WEB_URL`, `PRODUCTION_API_URL` |
| GitHub repository variables | ninguna credencial | duplicar solo `PRODUCTION_WEB_URL` y `PRODUCTION_API_URL` para el monitor programado |

El monitor no usa el Environment protegido: hacerlo exigiría aprobación manual cada 15 minutos. Las dos URLs del monitor no son secretos.

## Railway

`.railway/railway.ts` declara dos environments y cinco recursos:

1. `tracelink-postgres`;
2. `tracelink-api`, una réplica inicial, migration pre-deploy y readiness;
3. `reservation-expiry`, cada 5 minutos;
4. `payment-reconciliation`, cada 5 minutos;
5. `notification-outbox`, cada 5 minutos.

Todos los cron terminan al finalizar. Las migrations usan archivos versionados; production nunca usa `db push` ni ejecuta seed demo. La primera aplicación de IaC conserva `PAYMENT_PROVIDER=fake` y `EMAIL_PROVIDER=fake` en ambos environments. Después de que staging base, DB y HTTPS estén verdes, habilitar Mercado Pago TEST/Resend mediante un cambio revisado; no editar el dashboard creando drift silencioso.

Primera configuración, desde un equipo autenticado:

```powershell
corepack pnpm exec railway login
corepack pnpm exec railway config plan --environment staging
corepack pnpm exec railway config apply --environment staging
```

Los nombres exactos de opciones deben confirmarse con `corepack pnpm exec railway config --help` de la versión fijada. El workflow `.github/workflows/railway-config.yml` es la ruta preferida porque conserva plan revisable y approval productivo.

En el equipo Windows usado para Fase 5B, una política de Control de aplicaciones bloqueó el ejecutable local `railway.exe`. No se intentó eludir la política. Usar el workflow revisado o una estación autorizada/WSL, siempre con tokens introducidos directamente en el proveedor.

Secrets Railway, solo nombres:

```text
DATABASE_URL
SESSION_SECRET
CSRF_SECRET
IDEMPOTENCY_SECRET
RATE_LIMIT_SECRET
PICKUP_CODE_SECRET
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
RESEND_API_KEY
```

Variables Railway no secretas o de routing:

```text
NODE_ENV
APP_ENV
HOST
PORT
TRUST_PROXY
LOG_LEVEL
WEB_ORIGIN
API_PUBLIC_URL
ORGANIZATION_SLUG
SESSION_COOKIE_SAME_SITE
DATABASE_POOL_MAX
DATABASE_CONNECTION_TIMEOUT_MS
DATABASE_IDLE_TIMEOUT_MS
PAYMENT_PROVIDER
PAYMENT_SUCCESS_URL
PAYMENT_FAILURE_URL
PAYMENT_PENDING_URL
PAYMENT_WEBHOOK_URL
CHECKOUT_RESERVATION_MINUTES
EMAIL_PROVIDER
EMAIL_FROM
EMAIL_REPLY_TO
STAFF_NOTIFICATION_EMAIL
```

En los dominios técnicos separados de Cloudflare/Railway se usa `SESSION_COOKIE_SAME_SITE=none`; la cookie es `__Host-`, HttpOnly y Secure. Si luego web/API comparten el mismo site, evaluar volver a `lax` y validar el flujo completo.

## Base y migrations

Antes de cada deploy:

1. revisar compatibilidad hacia atrás y locks;
2. confirmar backup reciente;
3. ejecutar `corepack pnpm db:migration:check`;
4. dejar que el pre-deploy ejecute `corepack pnpm db:migrate`;
5. comprobar `/api/v1/health/ready`;
6. ejecutar smoke tests.

La migration Fase 5 agrega `OutboxEvent` de forma aditiva. No contiene drops.

## Bootstrap productivo

No ejecutar `db:seed` en production. Después de aplicar migrations y con una base vacía, definir temporalmente las variables `BOOTSTRAP_*` documentadas en `.env.example`/checklist y ejecutar como one-off:

```powershell
corepack pnpm production:bootstrap
```

En una imagen compilada:

```text
node apps/api/dist/jobs/bootstrap-production.js
```

El comando exige `NODE_ENV=production`, `APP_ENV=production` y `BOOTSTRAP_CONFIRM=CREATE_CH_MARKET`; crea solo Organization, settings, roles, permisos, Membership y SUPER_ADMIN. Falla si `ch-market` ya existe. Eliminar inmediatamente las variables de password/confirmación del servicio y probar el login antes de cargar catálogo e inventario.

## Dominio y DNS

El dominio comercial sigue **POR DEFINIR**. Cuando exista:

1. agregar el custom domain en Cloudflare Pages;
2. agregar el dominio API en Railway;
3. crear los registros DNS indicados por ambos proveedores;
4. elegir canonical host y redirigir `www`/no-`www`;
5. esperar certificados válidos;
6. actualizar `WEB_ORIGIN`, `API_PUBLIC_URL`, callbacks y webhook;
7. revalidar cookies, CORS, CSRF, CSP y smoke tests.

No modificar DNS automáticamente.

## Rollback

- Aplicación: volver al último deployment conocido y compatible.
- Base: no revertir automáticamente una migration aplicada. Preferir compatibilidad expand/contract y forward fix.
- Si hay corrupción o pérdida, seguir `docs/disaster-recovery.md`; nunca restaurar sobre production sin aislar y verificar primero.
