# Deployment de TraceLink V2

> **22/10/2026 — staging migra a Neon + Render + GitHub Actions.** Railway
> eliminó todos los deployments de staging el 15/10/2026 ~01:06 UTC (fin del
> trial) y su incidente de seguridad del 21/10 pausó los builds Hobby. Staging
> pasa al plan gratuito descrito en
> [Staging en Neon + Render + GitHub Actions](#staging-en-neon--render--github-actions).
> Railway staging queda inactivo, no eliminado; production sigue en Railway. El
> estado de septiembre que sigue es histórico.

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
  -> production: Railway Config plan/apply
     -> Railway PostgreSQL
     -> tracelink-api
     -> reservation-expiry cron
     -> payment-reconciliation cron
     -> notification-outbox cron
  -> staging: Deploy staging
     -> migrations sobre Neon
     -> Render deploy hook (commit exacto de CI)
     -> Staging scheduled jobs cada 30 min
  -> Cloudflare Pages
     -> React SPA
```

Staging y production son environments independientes. No deben compartir base, secretos, tokens de proveedores ni remitentes.

## Entornos

| Entorno | Web | API/DB | Pago | Email |
| --- | --- | --- | --- | --- |
| local | Vite | PostgreSQL local | fake | fake |
| staging inicial | Cloudflare Pages preview | Render Free + Neon Free (antes Railway staging) | fake | fake |
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
| GitHub Environment `staging` (solo rama `main`) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, `SESSION_SECRET`, `CSRF_SECRET`, `IDEMPOTENCY_SECRET`, `RATE_LIMIT_SECRET`, `PICKUP_CODE_SECRET`, `RENDER_DEPLOY_HOOK_URL` | `CLOUDFLARE_PAGES_PROJECT` |
| GitHub Environment `production` | `RAILWAY_PRODUCTION_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `RAILWAY_PROJECT_ID`, `CLOUDFLARE_PAGES_PROJECT`, `PRODUCTION_API_BASE_URL`, `PRODUCTION_WEB_URL`, `PRODUCTION_API_URL` |
| GitHub repository variables | ninguna credencial | `STAGING_API_BASE_URL`, `STAGING_WEB_URL`, `STAGING_API_URL`, `STAGING_RENDER_ENABLED`; `RAILWAY_STAGING_ENABLED` solo para volver a Railway staging; duplicar solo `PRODUCTION_WEB_URL` y `PRODUCTION_API_URL` para el monitor programado |

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

## Staging en Neon + Render + GitHub Actions

Plan gratuito para staging. Production no cambia. Nada se activa hasta que la
repository variable `STAGING_RENDER_ENABLED` vale `true`; mientras tanto los
jobs nuevos se omiten y Pages/smoke siguen como antes.

| Pieza | Servicio | Configuración |
| --- | --- | --- |
| Base | Neon Free, proyecto `tracelink-staging` | PostgreSQL 18 (igual que CI), AWS `us-east-1`, autoscaling máximo 0.25 CU, DB `tracelink` |
| API | Render Free Web Service | región Virginia, rama `main`, **Auto-Deploy Off**, Node 24 |
| Migrations | `Deploy staging` → `Staging migrations (Neon)` | `pnpm db:migrate` antes de cada deploy |
| Deploy | `Deploy staging` → `Render API staging` | deploy hook con `ref=<sha de CI>`; espera a que `/api/v1/health/live` informe ese commit |
| Cron | `Staging scheduled jobs` (`7,37 * * * *`) | los tres jobs en secuencia, independientes entre sí, más el smoke de staging |
| `db:verify` | `Staging database verify` (manual) | Render Free no tiene shell ni SSH |

Usar la cadena **directa** de Neon (sin `-pooler`) con `sslmode=require`: las
migrations y `staging:init` usan advisory locks, que no funcionan detrás de
PgBouncer en modo transacción. Copiarla solo a Render y al Environment
`staging`; no a archivos, chat ni logs.

Render:

- build: `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @tracelink/contracts build && corepack pnpm --filter @tracelink/api build`;
- start: `corepack pnpm --filter @tracelink/api start`;
- health check: `/api/v1/health/live`. No usar `/ready`: cada chequeo despertaría
  Neon y agotaría su cuota gratuita;
- variables: `NODE_ENV=production`, `APP_ENV=staging`, `HOST=0.0.0.0`,
  `TRUST_PROXY=1` (validar la IP cliente real en logs), `LOG_LEVEL=info`,
  `ORGANIZATION_SLUG=ch-market`, `SESSION_COOKIE_SAME_SITE=none`,
  `PAYMENT_PROVIDER=fake`, `EMAIL_PROVIDER=fake`, `DATABASE_POOL_MAX=10`,
  `DATABASE_CONNECTION_TIMEOUT_MS=10000`, `DATABASE_IDLE_TIMEOUT_MS=30000`,
  `WEB_ORIGIN=https://staging.tracelink.pages.dev`, `API_PUBLIC_URL` (origin
  `onrender.com` del servicio), `DATABASE_URL` y los cinco secretos de aplicación;
- `PORT` y `RENDER_GIT_COMMIT` los inyecta Render. La API expone ese commit en
  `release.commit` de `/api/v1/health` (también `RAILWAY_GIT_COMMIT_SHA` en Railway).

Los cinco secretos de aplicación se generan nuevos para Render (no reutilizar
los de Railway, expuestos al incidente del 21/10). Los jobs usan el mismo
`loadEnvironment` que la API, por eso el Environment `staging` de GitHub guarda
una copia. Restringir ese Environment a la rama `main` antes de cargarlos.

Activación, con autorización del owner:

1. crear Neon y Render (Auto-Deploy Off) con las variables anteriores;
2. en GitHub: rama `main` para el Environment `staging`, sus secrets, y retirar
   `RAILWAY_STAGING_TOKEN` (invalidado por Railway);
3. actualizar `STAGING_API_BASE_URL` y `STAGING_API_URL` al origin de Render y
   fijar `STAGING_RENDER_ENABLED=true`;
4. ejecutar `Deploy staging` (manual o tras CI en `main`): migrations, deploy
   del commit, Pages y smoke;
5. ejecutar `Staging database verify` y `Staging scheduled jobs` manualmente;
6. detenerse antes de `staging:init`.

La DB parte vacía: staging nunca tuvo la organización `ch-market`, así que no
hay datos que migrar desde Railway.

Presupuesto Free: Neon cobra ~0.25 CU por hora despierta y se suspende tras 5
minutos sin actividad; 24/7 serían ~183 CU-h frente a 100 incluidas. Con jobs y
smoke cada 30 minutos queda despierta ~20% (~40 CU-h) más el uso manual. Render
Free duerme tras 15 minutos sin tráfico (arranque ~1 minuto, cubierto por el
smoke) y tiene 750 h/mes por workspace. Actions es gratuito en este repositorio
público, pero GitHub puede retrasar schedules y los desactiva tras 60 días sin
actividad. En staging, las reservas vencidas liberan stock hasta ~30 minutos
después de expirar.

Rollback: quitar `STAGING_RENDER_ENABLED`, restaurar las URLs Railway y fijar
`RAILWAY_STAGING_ENABLED=true` con un token Railway nuevo.

## Railway

Desde el 22/10/2026 esta sección rige production. Railway staging sigue
declarado en `.railway/railway.ts` pero inactivo: sus jobs de plan/apply solo
corren con `RAILWAY_STAGING_ENABLED=true`. No quitar staging de ese archivo
mientras existan sus recursos, porque el plan los eliminaría.

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
una clave de acceso a toda la cuenta. Bajo autorización staging-only, no registrar
claves de cuenta/workspace con alcance mayor: detenerse hasta disponer de acceso
compatible y autorizado. Mantener cualquier clave privada fuera del chat y del
repositorio. Véase [Railway SSH](https://docs.railway.com/cli/ssh).
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

## Staging initialization

`staging:init != production:bootstrap` y `staging:init != db:seed`.
`production:bootstrap` continúa reservado exclusivamente para production.
El inicializador de staging es un one-off explícito: no está conectado al arranque
de la API, migrations, cron, pre-deploy ni workflows. **No ejecutar todavía en
Railway**: primero revisar/mergear el PR y autorizar separadamente su ejecución.

Con staging en Render Free no hay shell ni SSH, y ningún workflow ejecuta este
comando. Correrlo contra Neon exige un mecanismo autorizado aparte, con
aprobación explícita del owner; las referencias a Railway SSH de esta sección
aplican solo si staging vuelve a Railway.

Desde la raíz del workspace:

```powershell
corepack pnpm staging:init
```

En la imagen compilada, desde la raíz de la aplicación:

```text
node apps/api/dist/jobs/initialize-staging.js
```

Ambas entradas usan exclusivamente variables del proceso; el nuevo comando no
carga `.env` ni admite passwords como argumentos. No escribir secretos en archivos,
historial de shell, logs, PR, chat o repositorio. No se agregan dependencias ni
migraciones y no cambia `db:verify`.

Gates obligatorios, evaluados antes de abrir conexiones:

| Variable | Valor obligatorio |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_ENV` | `staging` |
| `PAYMENT_PROVIDER` | `fake` |
| `EMAIL_PROVIDER` | `fake` |
| `STAGING_INIT_CONFIRM` | `INIT_CH_MARKET` |
| `DATABASE_URL` | conexión privada de PostgreSQL **staging**, ya inyectada por Railway |

Si están presentes, `RAILWAY_ENVIRONMENT_NAME` debe ser `staging` y
`ORGANIZATION_SLUG` debe ser `ch-market`. No se acepta `BOOTSTRAP_CONFIRM` como
sustituto. Variables de entorno correctas no prueban por sí solas la identidad
de una DB: el operador debe comprobar proyecto, environment y referencia privada
antes de autorizar cualquier ejecución. No copiar una URL de production.

Settings requeridos, sin datos comerciales de ejemplo ni defaults de contacto:

- `STAGING_CONTACT_EMAIL`: correo autorizado de contacto de staging;
- `STAGING_CONTACT_PHONE`: contacto autorizado, entre 6 y 32 caracteres;
- `STAGING_PICKUP_ADDRESS`: texto autorizado de ubicación de staging;
- `STAGING_PICKUP_INSTRUCTIONS`: instrucciones de staging, sin datos de clientes.

Se crean `CH Market / ch-market / es-CL / CLP / America/Santiago`, settings con
umbrales mínimos 5 (stock), 5 (días de paquetes), 30 (vencimientos), los seis roles
del catálogo central y sus permisos. No se crean catálogo, inventario, clientes,
pedidos, paquetes, pagos, sesiones, eventos comerciales ni outbox.

Sin `STAGING_ADMIN_EMAIL` y `STAGING_ADMIN_PASSWORD` no se crea usuario ni
Membership. Proporcionar solo una variable, valores vacíos o inválidos aborta
toda la operación. Solo cuando sea necesario validar login staff, proporcionar
ambas mediante inyección segura en memoria al proceso autorizado. La contraseña
debe generarse criptográficamente (por ejemplo, 32 bytes aleatorios), tener
24–128 caracteres, no imprimirse ni persistirse en archivos. Se almacena únicamente
su hash Argon2id en PostgreSQL. El usuario usa el rol `ADMIN`, sin perfil Customer
y sin marcar su correo como verificado. No crea credenciales productivas.

Idempotencia y conflictos:

- Transacción única, advisory lock de staging y locks de filas; dos ejecuciones
  simultáneas no duplican datos. Timeout de locks: 10 segundos.
- Se crean entidades ausentes. Repetir la misma configuración no cambia IDs,
  hashes, timestamps ni descripciones existentes.
- Organización inactiva o con identidad/locale/moneda/zona distintos: abortar.
- Settings existentes distintos de los valores solicitados/umbrales iniciales:
  abortar, no sobrescribir. No es una herramienta de edición de settings.
- Roles existentes deben ser del catálogo, de sistema y con sus permisos exactos.
  Permisos agregados o revocados son conflicto, no se corrigen automáticamente.
  Un rol entero ausente sí se crea. Descripciones existentes se conservan.
- Email existente: solo se acepta un usuario activo con una única Membership
  activa `ADMIN` en CH Market, sin perfil Customer y con contraseña coincidente.
  Nunca adopta usuarios ajenos, eleva roles, reactiva accesos ni rota passwords.
- Cualquier conflicto produce rollback completo, salida no cero y un código
  seguro (`STAGING_INIT_ENV_INVALID`, `STAGING_INIT_CONFLICT` o
  `STAGING_INIT_FAILED`); no muestra valores de configuración ni errores del driver.

Validación posterior esperada, **no realizada por este PR**: usar el mecanismo
oficial autenticado de Railway, con acceso autorizado a staging, y ejecutar desde
el contenedor `tracelink-api`:

```powershell
corepack pnpm exec railway ssh -p b51b9995-341a-4f32-8670-495d7a0af0cd -e staging -s tracelink-api corepack pnpm db:verify
```

No usar `railway run` local como sustituto, no exportar/mostrar `DATABASE_URL` y
no abrir TCP público de PostgreSQL. Las claves SSH de Railway se registran por
cuenta/workspace, no por environment: si no existe acceso compatible con la
restricción staging-only, **detenerse**, no registrar una clave de alcance mayor.
Un fallo de `db:verify` bloquea la inicialización; una vez inicializado con nueva
autorización, repetir la verificación y validar login/cookie/CSRF. Retirar las
variables temporales de administrador y confirmación tras su uso autorizado.

Las pruebas de este comando usan una tercera base PostgreSQL embebida,
`tracelink_staging_init_test`, vacía y sin seed. Comprueban gates, ausencia de
datos demo, idempotencia/concurrencia, rollback, no elevación de identidades,
login real local y ausencia de secretos en stdout/stderr. Las suites históricas
siguen usando sus propios fixtures aislados: nunca la DB staging de Railway.

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
