# Pre-production checklist

Estado actualizado por la auditoría Fase 5D del 13 de septiembre de 2026.

Leyenda:

- **PASS:** evidencia ejecutada y registrada.
- **FAIL:** ejecución realizada con resultado incorrecto.
- **BLOCKED:** no ejecutable todavía por dependencia externa/decisión del owner.
- **NOT APPLICABLE:** deliberadamente fuera del alcance actual.

No se autoriza production ni LIVE mientras existan blockers críticos de staging, seguridad HTTPS, pagos sandbox, backup/restore, monitoreo o legales.

## Código y Git

| Gate | Estado | Evidencia/acción |
| --- | --- | --- |
| Fase 4 committed/pushed | PASS | historial remoto disponible |
| Fase 5 en `feature/phase-5-production` | PASS | branch sincronizada con origin |
| instalación congelada | PASS | pnpm lockfile reproducible |
| lint/typecheck/tests/build/migrations | PASS | CI remota run `34734239898`; lint, typecheck, tests, migration check y build F5D PASS |
| E2E PostgreSQL aislado | PASS | 11 recorridos HTTP reales |
| Chrome/Edge local y responsive | PASS | 375/768/1024/1440 sin overflow/page errors |
| PR abierta y CI remota verde | PASS | PR [#1](https://github.com/ErickColvin/TraceLink/pull/1); run `34734239898` verde para `efc9f81` |
| protección de `main` | PASS | PR obligatorio, checks strict, admins incluidos, conversaciones resueltas, sin force-push/delete |
| merge a `main` | BLOCKED | gate operativo: no mergear este PR hasta obtener/revisar ambos planes Railway y sus artifacts |

## GitHub y despliegue

| Gate | Estado | Evidencia/acción |
| --- | --- | --- |
| workflows revisados | PASS | triggers, permisos, Node/pnpm, cache, environments y failure behavior auditados |
| environment `staging` | PASS | creado; 0 secrets y 0 variables, configuración pendiente |
| environment `production` con reviewer | PASS | creado con un reviewer; `prevent_self_review=false` porque solo existe un colaborador |
| Railway IaC plan revisado | BLOCKED | run `34734240023`: staging falló por token ausente; production espera approval; 0 artifacts |
| deploy production manual | PASS | solo `workflow_dispatch` sobre `main`; no ejecutado |

## Staging

| Gate | Estado |
| --- | --- |
| Cloudflare Pages HTTPS | BLOCKED |
| Railway API HTTPS | BLOCKED |
| Railway PostgreSQL | BLOCKED |
| cinco recursos IaC provisionados | BLOCKED |
| migrations gestionadas aplicadas | BLOCKED |
| `db:verify` contra gestionada | BLOCKED |
| URLs registradas | BLOCKED |
| smoke externo | BLOCKED |
| deep links sin 404 del edge | BLOCKED |

## Seguridad

| Gate | Estado | Evidencia/acción |
| --- | --- | --- |
| cookie `__Host-`, HttpOnly, Secure, Path=/ sin Domain | PASS local / BLOCKED HTTPS |
| SameSite configurable | PASS local / BLOCKED HTTPS |
| CORS exacto con credentials sin wildcard | PASS local / BLOCKED HTTPS |
| CSRF ligado a sesión | PASS local / BLOCKED HTTPS |
| sesión expirada + returnTo seguro + relogin | PASS local / BLOCKED HTTPS |
| HSTS no-local y headers API/frontend | PASS config / BLOCKED HTTPS |
| rate limit compartido PostgreSQL | PASS local / BLOCKED gestionado |
| redacción de logs y request ID | PASS local / BLOCKED Railway logs |
| revisión de secretos/permisos mínimos | BLOCKED |

## Pagos Mercado Pago TEST

Todos requieren proveedor real TEST; FakePaymentProvider no es evidencia.

| Gate | Estado |
| --- | --- |
| credenciales solo TEST en staging | BLOCKED |
| buyer/seller TEST | BLOCKED |
| approved | BLOCKED |
| pending | BLOCKED |
| rejected | BLOCKED |
| cancelación pending | BLOCKED |
| retry sobre misma order | BLOCKED |
| full refund | BLOCKED |
| webhook HTTPS firmado | BLOCKED |
| firma inválida | BLOCKED |
| webhook duplicado/fuera de orden | BLOCKED |
| reconciliation de webhook perdido | BLOCKED |
| return URL no autoritativa | PASS local / BLOCKED proveedor |

## Jobs y notificaciones

| Gate | Estado |
| --- | --- |
| `reservation-expiry` cada 5 min y exit 0 | BLOCKED |
| `payment-reconciliation` cada 5 min y exit 0 | BLOCKED |
| `notification-outbox` cada 5 min y exit 0 | BLOCKED |
| fallo controlado no destructivo detectado | BLOCKED |
| outbox lease/retry/idempotencia | PASS local / BLOCKED Railway |
| seis emails aceptados/entregados por Resend | BLOCKED |
| dominio/remitente SPF y DKIM verificado | BLOCKED |
| webhook Resend | NOT APPLICABLE |

## Datos y recuperación

| Gate | Estado |
| --- | --- |
| backup nativo diario | BLOCKED |
| backup nativo semanal | BLOCKED |
| PITR según plan/coste aprobado | BLOCKED |
| `pg_dump` cifrado offsite | BLOCKED |
| restore en nueva DB aislada | BLOCKED |
| RPO observado | BLOCKED — no medido |
| RTO observado | BLOCKED — no medido |
| integridad/health/login/reads restaurados | BLOCKED |
| Organization CH Market por bootstrap | BLOCKED |
| SUPER_ADMIN nominal y MFA proveedor | BLOCKED |
| Settings, roles y permisos productivos | BLOCKED |
| catálogo real sin fixtures | BLOCKED |
| inventario/lotes conciliados | BLOCKED |
| punto de retiro real | BLOCKED |

## Operación y go-live

| Gate | Estado |
| --- | --- |
| health/readiness separados | PASS local |
| monitor GitHub versionado | PASS config |
| monitor con runs reales | BLOCKED |
| canal y responsable de alertas | BLOCKED |
| alertas API/readiness/5xx/DB/jobs/webhooks/outbox | BLOCKED |
| logs Railway sin secretos | BLOCKED |
| runbook técnico versionado | PASS |
| runbook aceptado por responsables | BLOCKED |
| textos legales aprobados | BLOCKED |
| staff entrenado | BLOCKED |
| rehearsal completo staging | BLOCKED |
| `docs/go-live-payments.md` aprobado | BLOCKED |
| activación LIVE | NOT APPLICABLE — expresamente no autorizada |

## Resultado

```text
PRODUCTION CHECKLIST: BLOCKED
PRODUCTION READINESS: NOT READY
LIVE PAYMENTS: NOT ACTIVATED
```

La evidencia y el orden exacto de desbloqueo están en `docs/staging-validation.md`. No ejecutar `production:bootstrap` ni cambiar proveedores desde `fake` hasta identificar y verificar el environment/DB objetivo.

## Resultado Fase 5D

La comprobación segura de presencia confirmó 0 secrets y 0 variables en GitHub
Environment `staging`. Por tanto no se ejecutaron plan/apply, deploy, migrations,
smoke ni pruebas HTTPS externas. Ningún gate cambió a PASS y los porcentajes se
mantienen: Fase 5D 0 %, Fase 5 total 83 %, Fase 4 95 %.

Quality gates locales F5D: contracts 15, API unit 124, API HTTP 14, web 145,
integration 37 y E2E 11, todos PASS. El build también confirmó que `_redirects`
y `_headers` se copiaron a `apps/web/dist`; esto no sustituye su comprobación en
Cloudflare real.
