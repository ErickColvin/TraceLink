# Deployment de TraceLink V2

## Estado verificable

Validación del 27 de septiembre de 2026: staging ya tiene infraestructura real,
frontend HTTPS y API HTTPS, pero **el cierre completo sigue pendiente**.

- PR [#3](https://github.com/ErickColvin/TraceLink/pull/3) fusionado como
  `a6a758a713e679a1e741686540c7f82b17fe38d7` el 27/09/2026 a las 00:21:33 UTC.
- [Apply 36282256328](https://github.com/ErickColvin/TraceLink/actions/runs/36282256328)
  SUCCESS: aplicó el plan fijado del PR (artifact `10919012457`, 8 creaciones,
  0 cambios, 0 eliminaciones), sin generar otro plan. Production SKIPPED.
- Railway staging: PostgreSQL 18, API y tres cron creados. Nueve migraciones
  aplicadas; último pre-deploy confirmó `Already up to date`, con ref
  `4c27837b13335fd2a0e15acd8d3bdf7b950a7cc7fa5bb8c7c3c6eabbbdbfaecd`.
- Web: <https://staging.tracelink.pages.dev> (alias preview confirmado por
  Cloudflare; deployment <https://e7e65257.tracelink.pages.dev>).
- API: <https://tracelink-api-staging.up.railway.app>. El dominio dirige al puerto
  **8080**, observado en el proceso Railway, no al default local 3001.
- [Deploy 36338394084](https://github.com/ErickColvin/TraceLink/actions/runs/36338394084):
  web y smoke SUCCESS (5 checks), desde `fix/staging-preview-preflight`.
  La corrección del workflow está en PR [#5](https://github.com/ErickColvin/TraceLink/pull/5),
  pendiente de merge; un deploy correcto desde esa rama no implica que `main`
  ya incluya el arreglo.
- Health y readiness externos: HTTP 200, `ok` / `ready`. CORS permite el origin
  exacto de staging; mutaciones con origin ajeno o ausente: 403.
- Los cinco secretos de aplicación están configurados directamente en Railway,
  sin valores guardados en archivos ni GitHub. Pago/email permanecen `fake`.

Pendientes reales: despliegue de la corrección de variables opcionales vacías
para los cron, acceso SSH para `db:verify`, e inicialización mínima autorizada
de la organización de staging para validar una sesión real. No se ejecutó seed
demo ni bootstrap productivo. Production no se tocó; Mercado Pago (TEST/LIVE)
y Resend no se activaron.

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
| staging después del gate base y nueva autorización | misma URL | misma API/DB | Mercado Pago TEST | Resend de prueba |
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
| GitHub Environment `staging` | `RAILWAY_STAGING_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_PAGES_PROJECT` |
| GitHub Environment `production` | `RAILWAY_PRODUCTION_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `RAILWAY_PROJECT_ID`, `CLOUDFLARE_PAGES_PROJECT`, `PRODUCTION_API_BASE_URL`, `PRODUCTION_WEB_URL`, `PRODUCTION_API_URL` |
| GitHub repository variables | ninguna credencial | `STAGING_API_BASE_URL`, `STAGING_WEB_URL`, `STAGING_API_URL`; duplicar solo `PRODUCTION_WEB_URL` y `PRODUCTION_API_URL` para el monitor programado |

Las tres variables `STAGING_*` deben estar en Repository Settings → Secrets and
variables → Actions → Variables: los `if` a nivel de job se evalúan antes de
publicar las variables del Environment. No duplicarlas únicamente en Environment.

| Repository variable | Valor público configurado |
| --- | --- |
| `STAGING_API_BASE_URL` | `https://tracelink-api-staging.up.railway.app/api/v1` |
| `STAGING_WEB_URL` | `https://staging.tracelink.pages.dev` |
| `STAGING_API_URL` | `https://tracelink-api-staging.up.railway.app` |

Orden de bootstrap comprobado: apply fijado → dominio API → cinco secretos y
`API_PUBLIC_URL` → repository `STAGING_API_BASE_URL` → primer deploy Pages (smoke
omitido) → alias real de staging → Railway `WEB_ORIGIN` → otras dos repository
variables → segundo deploy y smoke. Nunca se usó un origin ficticio ni se relajó
CORS/CSRF. `API_PUBLIC_URL` y `WEB_ORIGIN` son origins sin `/api/v1`; únicamente
`STAGING_API_BASE_URL` incluye ese path.

Wrangler se instala/ejecuta desde `apps/web` y despliega `dist`, evitando la
instalación en la raíz del workspace. El guard de preview consulta el proyecto
Cloudflare y bloquea si su rama productiva es `staging` o no puede verificarse.
Ese guard es un step `run` independiente: `preCommands` de Wrangler separa las
líneas y no conserva un heredoc multilínea.

El monitor no usa el Environment protegido: hacerlo exigiría aprobación manual cada 15 minutos. Las dos URLs del monitor no son secretos.

## Railway

`.railway/railway.ts` declara dos environments y cinco recursos:

1. `tracelink-postgres`;
2. `tracelink-api`, una réplica inicial, migration pre-deploy y readiness;
3. `reservation-expiry`, cada 5 minutos;
4. `payment-reconciliation`, cada 5 minutos;
5. `notification-outbox`, cada 5 minutos.

Todos los cron terminan al finalizar. Las migrations usan archivos versionados; production nunca usa `db push` ni ejecuta seed demo. La primera aplicación de IaC conserva `PAYMENT_PROVIDER=fake` y `EMAIL_PROVIDER=fake` en ambos environments. Después de que staging base, DB y HTTPS estén verdes, habilitar Mercado Pago TEST/Resend mediante un cambio revisado; no editar el dashboard creando drift silencioso.

El workflow `.github/workflows/railway-config.yml` conserva el plan revisado del
head del PR y, después del merge, ejecuta `railway config apply --plan
railway-plan.json`. Si falla, inspeccionar primero la causa: no reemplazarlo
silenciosamente por otro plan ni ejecutar un apply manual inmediato. `main`
exige los cuatro jobs universales de CI. Los planes Railway son un gate operativo
para PR con cambios de infraestructura, no checks globales para cualquier PR.

La CLI autenticada es `5.52.0`, proyecto `b51b9995-341a-4f32-8670-495d7a0af0cd`,
environment staging `0fb9a446-4fba-4a86-becc-53413c50d292`. Confirmar las opciones
con `--help`; no registrar valores de `railway variable list --json` en reportes.
`RAILWAY_PRODUCTION_ENABLED` continúa ausente; no crear esa variable ni modificar
credenciales o recursos de production en esta fase.

Los tres cron tienen `*/5 * * * *`, restart `NEVER` y pool de DB 2. La primera
validación de runtime detectó que referencias a variables opcionales ausentes
se resolvían como `""` y hacían fallar Zod antes de ejecutar el job. La corrección
normaliza solo campos opcionales de proveedores vacíos como ausentes: Mercado
Pago y Resend siguen exigiendo sus credenciales cuando están seleccionados;
secretos de aplicación y origins obligatorios no cambian. Hasta desplegar esa
corrección y observar eventos de finalización, los jobs **no están validados**.

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

Para verificar el contrato contra staging, desde el equipo del owner con una
clave SSH autorizada en Railway:

```powershell
corepack pnpm exec railway ssh -p b51b9995-341a-4f32-8670-495d7a0af0cd -e staging -s tracelink-api corepack pnpm db:verify
```

Este comando usa la conexión privada del contenedor. La ejecución externa quedó
bloqueada por `No SSH keys found`; no se publicó PostgreSQL por TCP ni se creó
una clave de acceso a toda la cuenta. El owner debe registrar su clave pública
con `railway ssh keys add --key <ruta-publica.pub> --name <nombre>` y mantener la
privada fuera del chat/repositorio. Véase [Railway SSH](https://docs.railway.com/cli/ssh).
El PASS de `db:verify` en tests locales aislados no reemplaza esta comprobación.

La prueba sintética de registro devolvió HTTP 500: el log correlacionado señala
que la consulta de la organización activa `ch-market` no devuelve una fila.
La transacción falló antes de insertar el usuario. No hay sesión con la cual
acreditar cookie real o CSRF autenticado. Hace falta autorizar un procedimiento
mínimo de inicialización exclusivo de staging; no reutilizar el bootstrap
productivo ni el seed demo. CORS/Origin sí se validaron externamente. Una sonda
con headers ficticios de cookie/Authorization quedó registrada sin sus valores,
y la muestra de logs de API no contenía ninguno de los cinco secretos ni la URL
completa de DB; esto no acredita todavía la ejecución sana de los cron.

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
