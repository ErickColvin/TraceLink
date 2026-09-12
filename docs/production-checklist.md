# Pre-production checklist

Estado al 12 de septiembre de 2026: el código/configuración local está preparado; los ítems externos permanecen sin marcar.

## Código y Git

- [x] Fase 4 committed y pushed en su branch.
- [x] Fase 5 desarrollada en `feature/phase-5-production`.
- [x] CI versionada con lint, types, tests, build, migration check y E2E.
- [ ] PR revisada, CI remota verde y merge a `main`.

## Staging

- [ ] Cloudflare Pages staging desplegado por HTTPS.
- [ ] Railway API staging desplegada por HTTPS.
- [ ] Railway PostgreSQL staging provisionado.
- [ ] Migrations aplicadas en DB gestionada.
- [ ] URLs reales registradas en `docs/staging-validation.md`.
- [ ] Smoke externo aprobado.

## Seguridad

- [x] Cookie productiva `__Host-`, HttpOnly, Secure, Path=/ y sin Domain.
- [x] SameSite configurable; `none` preparado para dominios técnicos separados.
- [x] CORS/Origin exacto y credentials sin wildcard.
- [x] CSRF ligado a la sesión y tests locales.
- [x] HSTS solo fuera de local; headers frontend/API configurados.
- [x] Rate limiting compartido en PostgreSQL.
- [x] Redacción de logs y errores con request ID.
- [ ] HTTPS real: cookie aceptada y enviada.
- [ ] HTTPS real: valid Origin, invalid Origin, token ausente e inválido.
- [ ] Sesión expirada: 401, limpieza, returnTo seguro y login.
- [ ] Revisión de secrets del entorno y permisos mínimos.

## Pagos sandbox

- [ ] Solo credenciales Mercado Pago TEST en staging.
- [ ] Pago approved.
- [ ] Pago pending.
- [ ] Pago rejected.
- [ ] Cancelación pending.
- [ ] Retry sobre la misma order.
- [ ] Full refund.
- [ ] Webhook HTTPS firmado.
- [ ] Webhook duplicado y fuera de orden.
- [ ] Reconciliation recupera webhook perdido.
- [ ] Return URLs no alteran pago por sí mismas.

## Jobs y notificaciones

- [ ] `reservation-expiry` ejecuta cada 5 min y termina 0.
- [ ] `payment-reconciliation` ejecuta cada 5 min y termina 0.
- [ ] `notification-outbox` ejecuta cada 5 min y termina 0.
- [ ] Resend staging entrega bienvenida, pedido creado, pago aprobado, listo, cancelado y refund.
- [ ] Retry/outbox idempotente validado con fallo temporal real.
- [ ] Dominio/remitente productivo verificado.

## Datos y recuperación

- [ ] Backup diario habilitado.
- [ ] Backup semanal habilitado.
- [ ] Estrategia offsite aprobada.
- [ ] Restore aislado completado y RPO/RTO medidos.
- [ ] Organization CH Market creada con bootstrap productivo.
- [ ] SUPER_ADMIN nominal y MFA del proveedor cuando esté disponible.
- [ ] Settings, roles y permisos verificados.
- [ ] Catálogo real aprobado y sin datos mock.
- [ ] Inventario/lotes iniciales conciliados.
- [ ] Punto de retiro real configurado.

## Operación y go-live

- [x] Health y readiness separados.
- [x] Monitor GitHub programado preparado.
- [ ] Variables de monitor y ejecución continua verificadas.
- [ ] Alertas de API/readiness/5xx/DB/jobs/webhooks activas.
- [ ] Runbook revisado por responsables.
- [ ] Textos legales aprobados reemplazan placeholders.
- [ ] Staff entrenado en pedidos, cancelaciones y refunds.
- [ ] `docs/go-live-payments.md` aprobado punto por punto.
- [ ] Activación LIVE deliberada por owner.

No se autoriza production/LIVE mientras queden pendientes los gates de staging, backup/restore, seguridad HTTPS, legales y pagos sandbox.
