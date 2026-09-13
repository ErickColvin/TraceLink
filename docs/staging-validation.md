# Validación de staging — Fase 5B

## Resultado ejecutivo

Auditoría realizada el 12 de septiembre de 2026.

| Campo | Resultado |
| --- | --- |
| branch candidata | `feature/phase-5-production` |
| último SHA de código/config auditado | `dc370ad30148080dd616b4e307a4134cde1f76c1` |
| branch publicada | PASS — igual a `origin/feature/phase-5-production` al cerrar cada commit |
| PR hacia `main` | BLOCKED — GitHub API pública informó 0 PR abiertas |
| GitHub Environments | BLOCKED — GitHub API pública informó 0 environments |
| ejecuciones de GitHub Actions | BLOCKED — GitHub API pública informó 0 runs |
| frontend URL | BLOCKED — no configurada |
| API URL | BLOCKED — no configurada |
| Railway staging | BLOCKED — no existe evidencia accesible del proyecto desplegado |
| PostgreSQL gestionado | BLOCKED — no existe instancia staging verificable |
| Cloudflare Pages | BLOCKED — no existe proyecto/URL verificable |
| Mercado Pago | BLOCKED — TEST no configurado; LIVE no activado |
| Resend | BLOCKED — cuenta/dominio/API key no configurados |

`PASS` significa prueba ejecutada con evidencia. `BLOCKED` significa que la prueba no puede ejecutarse hasta que el owner configure el recurso o acceso indicado. `NOT APPLICABLE` significa fuera del alcance deliberado de esta ejecución. No se usan checks implícitos ni se considera aprobado un proveedor por existir configuración local.

No se imprimieron tokens, passwords, cookies, claves API ni valores de `.env` durante la auditoría.

## Evidencia local renovada

| Gate | Resultado | Evidencia |
| --- | --- | --- |
| instalación reproducible | PASS | `corepack pnpm install --frozen-lockfile` |
| lint | PASS | workspace completo |
| TypeScript strict | PASS | workspace completo |
| tests agregados | PASS | contracts 15; API unit 124; API foundation 14; web 145; integración 37 |
| integración explícita | PASS | 9 archivos, 37 tests, PostgreSQL aislado |
| E2E | PASS | 11 recorridos HTTP reales con PostgreSQL aislado |
| migration check | PASS | `All checks passed` |
| build | PASS | contracts, API y web; `apps/web/dist` generado |
| database verify local | PASS | PostgreSQL 18 embebido, 9 migrations y marker verificados |
| frontend HTTP build | PASS | `VITE_DATA_MODE=http`, API HTTPS no resoluble de prueba; `_headers` y `_redirects` copiados a `dist` |
| revisión visual Chrome local | PASS | 375, 768, 1024 y 1440 px; sin overflow ni page errors |
| revisión visual Edge local | PASS | mismos recorridos/viewports; sin overflow ni page errors |
| Safari | BLOCKED | no hay Safari disponible en este equipo Windows |

La prueba local es evidencia de software, no sustituye staging HTTPS. Las capturas se generaron en el directorio temporal del sistema y no se versionaron.

La ejecución explícita inicial de integración detectó una carrera del test de reintento de outbox: el evento se fijaba en `now()` y podía no ser reclamable en el mismo instante. El fixture ahora fija `next_attempt_at` un segundo en el pasado. El backoff productivo no fue reducido y el rerun terminó con 37/37 tests.

## F5B.1 — Git y baseline

**PASS**

- branch correcta y sincronizada con origin;
- commits históricos de Fase 5 publicados;
- worktree limpio antes de iniciar;
- baseline requerido completo en verde;
- PostgreSQL local verificado con el runner embebido existente, sin introducir otra estrategia.

## F5B.2 — GitHub environments y workflows

**BLOCKED — MANUAL OWNER ACTION REQUIRED**

La auditoría pública confirmó 0 environments, 0 Actions runs y 0 PR abiertas. Sin autenticación GitHub no es posible crear environments, configurar secretos/variables, protección de `main` ni abrir la PR desde esta estación. `gh` tampoco está instalado.

La revisión estática sí quedó corregida y publicada:

- `ci.yml`: PR + push a `main`, permisos read-only, Node 24, pnpm 11.24.0, cache, suites separadas y cancelación de runs obsoletos;
- `railway-config.yml`: plan/apply con artefactos separados, bloqueo destructivo en production y jobs ligados a su environment correcto;
- `deploy-staging.yml`: solo después de CI verde en `main`; build HTTP, Cloudflare y smoke ligados a `staging`;
- `deploy-production.yml`: solo `workflow_dispatch` sobre `main`, environment `production`, gates repetidos y deploy deliberado;
- `monitor-availability.yml`: schedule cada 15 minutos, pero no existe run real.

Acción del owner en GitHub, sin compartir valores por chat:

1. `Settings > Environments`: crear `staging` y `production`.
2. En `production`: añadir al menos un required reviewer y, si está disponible, impedir self-review.
3. Configurar los nombres indicados en “Acciones restantes”.
4. Abrir PR `feature/phase-5-production` -> `main` y exigir CI verde antes de merge.
5. Revisar el Railway plan de la PR; no aprobar cambios destructivos.

## F5B.3 y F5B.4 — Railway y PostgreSQL gestionado

**BLOCKED — MANUAL OWNER ACTION REQUIRED**

Se consultó documentación Railway vigente antes de intentar la CLI. La versión fijada del repositorio es `@railway/cli 5.52.0`, compatible con Infrastructure as Code actual. En este Windows, Control de aplicaciones bloquea `railway.exe`; además no hay `RAILWAY_TOKEN` ni `RAILWAY_API_TOKEN` disponibles. No existe archivo de enlace local a un proyecto.

La ruta prevista y revisable es la GitHub Action `railwayapp/config@v1`. La configuración declara:

- `tracelink-postgres`;
- `tracelink-api` con migration pre-deploy y readiness;
- `reservation-expiry`;
- `payment-reconciliation`;
- `notification-outbox`.

Todos los proveedores externos parten en `fake`, incluidos staging y production. Mercado Pago TEST y Resend solo deben habilitarse mediante un cambio posterior revisado, después de aprobar API, DB y HTTPS base.

No se ejecutó `db:seed`, `db push` ni bootstrap productivo. En staging gestionado siguen pendientes migrations, `db:verify`, constraints, índices, marker y readiness.

## F5B.5 — Cloudflare Pages

**BLOCKED — MANUAL OWNER ACTION REQUIRED**

El build HTTP local fue exitoso y confirmó `apps/web/dist`, `_headers` y `_redirects`. La estrategia SPA existente coincide con la configuración estática de Cloudflare Pages. No existe `CLOUDFLARE_API_TOKEN`, account ID, proyecto ni URL accesible, por lo que no se puede afirmar deploy, fallback del edge, headers reales ni caching.

No se realizaron cambios DNS.

## F5B.6 — Smoke HTTPS, health, auth, cookies, CORS y CSRF

**BLOCKED — no existen `STAGING_WEB_URL` ni `STAGING_API_URL`**

Cuando existan URLs reales:

```powershell
$env:SMOKE_WEB_URL="https://<staging-web>"
$env:SMOKE_API_URL="https://<staging-api>"
node tools/smoke-deployment.mjs
```

Debe comprobarse externamente:

- frontend y deep links `/login`, `/registro`, `/mi-cuenta`, `/app/dashboard`, `/checkout/resultado`, `/terminos`, `/privacidad` y `/cambios-y-devoluciones`;
- `GET /api/v1/health` = proceso vivo;
- `GET /api/v1/health/ready` = API y DB disponibles;
- cookie `__Host-`, HttpOnly, Secure, Path=/ y SameSite configurado;
- login, sesión restaurada, logout, expiración y relogin;
- Origin válido, inválido y ausente según el caso;
- CSRF válido, ausente e inválido;
- HSTS y headers reales, sin filtrar internals.

## F5B.7 — Mercado Pago TEST

**BLOCKED — no existe staging base ni credencial TEST configurada**

Se revisó documentación oficial actual de Mercado Pago Chile. Orders utiliza `POST /v1/orders`, exige `Authorization` y `X-Idempotency-Key`, entrega checkout para el flujo correspondiente, y los webhooks de Order usan URL HTTPS y firma `x-signature`. Las cuentas seller/buyer TEST deben ser del mismo país. No se usó cuenta personal ni credencial LIVE.

| Escenario | Resultado |
| --- | --- |
| approved | BLOCKED |
| pending | BLOCKED |
| rejected | BLOCKED |
| return URL manipulada | BLOCKED |
| webhook HTTPS firmado | BLOCKED |
| firma inválida | BLOCKED |
| webhook duplicado/fuera de orden | BLOCKED |
| lost webhook + reconciliation | BLOCKED |
| full refund | BLOCKED |

Fase 4 permanece en 95 %. FakePaymentProvider no se contó como validación de Mercado Pago.

## F5B.8 — Resend

**BLOCKED — no existe cuenta/dominio/remitente verificable**

La documentación actual de Resend exige dominio propio y verificación SPF/DKIM para enviar a destinatarios distintos del owner; DMARC es recomendado. No se declaró verificación por existir DNS teórico.

| Email | Resultado |
| --- | --- |
| welcome | BLOCKED |
| order created | BLOCKED |
| payment approved | BLOCKED |
| ready for pickup | BLOCKED |
| cancelled | BLOCKED |
| refunded | BLOCKED |

El webhook Resend es **NOT APPLICABLE** para Fase 5B: no formaba parte del alcance y no se amplió el producto.

## F5B.9 — Cron jobs

**BLOCKED — servicios Railway no desplegados**

La configuración local usa `*/5 * * * *`, la frecuencia mínima vigente soportada por Railway. Los ejecutables cierran sus conexiones y los tests locales cubren salida exitosa/fallida, leases, retry e idempotencia. Faltan runs reales y logs de:

| Job | Resultado |
| --- | --- |
| reservation-expiry | BLOCKED |
| payment-reconciliation | BLOCKED |
| notification-outbox | BLOCKED |
| fallo controlado + detección | BLOCKED |

## F5B.10 y F5B.11 — Backups y restore drill

**BLOCKED — no existe PostgreSQL Railway staging**

No se declaró backup por existir documentación. Faltan schedules nativos diarios/semanales, copia lógica cifrada offsite y restauración en una base nueva aislada.

| Medición | Resultado |
| --- | --- |
| backup real | BLOCKED |
| restore aislado | BLOCKED |
| RPO observado | NO MEDIDO |
| RTO observado | NO MEDIDO |
| `db:verify` restaurado | BLOCKED |
| integrity/health/login/reads | BLOCKED |

## F5B.12 — Monitoring, alertas y logs

**BLOCKED — no hay endpoints ni runs remotos**

Existe monitor preparado cada 15 minutos, pero GitHub informó 0 ejecuciones. No hay canal de alertas ni responsable nominal registrado. Faltan alertas reales para disponibilidad, readiness, 5xx, tres jobs y outbox DEAD/backlog.

La redacción de logs está cubierta localmente por código/tests, pero revisar Railway logs reales continúa bloqueado. No se declara PASS externo.

## F5B.13 — Seguridad HTTPS

**BLOCKED — no existe superficie HTTPS desplegada**

Los controles de cookie, CORS exacto, CSRF, rate limit, HSTS condicional y redacción pasan localmente. Faltan respuestas HTTPS reales de Cloudflare/Railway, DevTools de browser y pruebas adversariales sobre staging.

## F5B.14 — Browser, mobile y performance

**PARCIAL**

- Chrome local: PASS;
- Edge local: PASS;
- 375/768/1024/1440 px: PASS;
- overflow horizontal/page errors: ninguno;
- Safari: BLOCKED;
- navegador móvil físico: BLOCKED;
- redirección/retorno real de Mercado Pago: BLOCKED;
- LCP/INP/CLS de staging: NO MEDIDOS por ausencia de URL.

Durante la revisión se corrigieron el texto obsoleto del carrito, la navegación interna del checkout demo y etiquetas demo que podían aparecer en sesión HTTP.

## F5B.15 — Legal y data readiness

**BLOCKED — MANUAL OWNER ACTION REQUIRED**

Las rutas legales mantienen visiblemente `PENDIENTE DE APROBACIÓN`; no se inventaron textos. También faltan datos de producción aprobados: dirección de retiro, usuarios nominales, catálogo, inventario, lotes y categorías. No se migrarán mocks/fixtures automáticamente.

El `production:bootstrap` no fue ejecutado porque no existe target productivo confirmado ni autorización deliberada. LIVE permanece desactivado.

## F5B.16 — Production rehearsal

**BLOCKED**

El recorrido local cubre registro/auth, catálogo, carrito, checkout, pedidos, inventario y paquetes, pero no sustituye el rehearsal completo en staging con Mercado Pago TEST, webhook HTTPS, Resend, jobs y refund.

## Estado de cierre

```text
FASE 5B: 10%
FASE 5 TOTAL: 80%
FASE 4: 95%
PRODUCTION READINESS: NOT READY
LIVE PAYMENTS: NOT ACTIVATED
```

El 80 % refleja preparación local adicional y correcciones verificadas sobre la base histórica de 78 %. Ningún gate externo crítico cambió a PASS; por eso no se declara Fase 5 completa ni producción lista.

## Acciones restantes del owner

Configurar únicamente en sus proveedores; no enviar valores por chat:

### GitHub Environment `staging`

```text
RAILWAY_STAGING_TOKEN=[CONFIGURAR EN GITHUB ENVIRONMENT STAGING]
CLOUDFLARE_API_TOKEN=[CONFIGURAR EN GITHUB ENVIRONMENT STAGING]
CLOUDFLARE_ACCOUNT_ID=[CONFIGURAR EN GITHUB ENVIRONMENT STAGING]
CLOUDFLARE_PAGES_PROJECT=[CONFIGURAR COMO VARIABLE EN STAGING]
STAGING_API_BASE_URL=[CONFIGURAR COMO VARIABLE EN STAGING]
STAGING_WEB_URL=[CONFIGURAR COMO VARIABLE EN STAGING]
STAGING_API_URL=[CONFIGURAR COMO VARIABLE EN STAGING]
```

### GitHub Environment `production`

```text
RAILWAY_PRODUCTION_TOKEN=[CONFIGURAR EN GITHUB ENVIRONMENT PRODUCTION]
CLOUDFLARE_API_TOKEN=[CONFIGURAR EN GITHUB ENVIRONMENT PRODUCTION]
CLOUDFLARE_ACCOUNT_ID=[CONFIGURAR EN GITHUB ENVIRONMENT PRODUCTION]
RAILWAY_PROJECT_ID=[CONFIGURAR COMO VARIABLE EN PRODUCTION]
CLOUDFLARE_PAGES_PROJECT=[CONFIGURAR COMO VARIABLE EN PRODUCTION]
PRODUCTION_API_BASE_URL=[CONFIGURAR COMO VARIABLE EN PRODUCTION]
PRODUCTION_WEB_URL=[CONFIGURAR COMO VARIABLE EN PRODUCTION]
PRODUCTION_API_URL=[CONFIGURAR COMO VARIABLE EN PRODUCTION]
```

El monitor programado necesita además `PRODUCTION_WEB_URL` y `PRODUCTION_API_URL` como variables no secretas de repositorio, porque no debe esperar approval productivo cada 15 minutos.

### Railway staging, solo después del deploy base con proveedores fake

```text
MERCADOPAGO_ACCESS_TOKEN=[CONFIGURAR EN RAILWAY STAGING]
MERCADOPAGO_WEBHOOK_SECRET=[CONFIGURAR EN RAILWAY STAGING]
RESEND_API_KEY=[CONFIGURAR EN RAILWAY STAGING]
```

Completar también las variables de routing/remitente ya enumeradas en `docs/deployment.md`, sin reutilizar secretos entre ambientes. Después: ejecutar todos los gates de este archivo en orden y adjuntar únicamente IDs, URLs, timestamps, status HTTP y request IDs no sensibles.
