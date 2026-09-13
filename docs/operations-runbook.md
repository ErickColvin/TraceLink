# Operations runbook

## Clasificación

- **SEV1:** pagos o datos no disponibles, pérdida/corrupción posible, acceso no autorizado o checkout ampliamente caído.
- **SEV2:** funcionalidad principal degradada con alternativa temporal; jobs, webhooks o email acumulando fallos.
- **SEV3:** defecto no crítico sin riesgo de datos ni interrupción importante.

Para todo incidente: registrar inicio, ambiente, deployment SHA, request IDs, servicios afectados, decisiones, owner y hora de recuperación. No copiar secretos, cuerpos completos, cookies ni PII a tickets/chat.

## Propiedad y canal de alerta

Estado Fase 5C (12 de septiembre de 2026): **BLOCKED — MANUAL OWNER ACTION REQUIRED**.

- responsable primario nominal: por asignar;
- suplente nominal: por asignar;
- canal inicial (email o notificación de proveedor): por definir y probar;
- escalamiento fuera de horario: por definir;
- evidencia de recepción de una alerta de prueba: no ejecutada.

El monitor no se considera activo hasta que una falla controlada genere una notificación y un responsable confirme recepción. No registrar direcciones personales en este documento público salvo aprobación del owner; pueden mantenerse como configuración privada del proveedor.

## Señales y alertas

| Señal | Condición inicial | Severidad sugerida |
| --- | --- | --- |
| frontend/API health caído | 2 checks consecutivos | SEV1/SEV2 según alcance |
| readiness 503 | 2 checks consecutivos | SEV1 |
| 5xx | aumento sostenido, no un evento aislado | SEV2 |
| reservation cron | ejecución fallida o ausente >15 min | SEV2 |
| reconciliation | cualquier lote con failures; repetido >10 min | SEV1/SEV2 |
| webhook | firma válida con 5xx o ausencia anómala | SEV1/SEV2 |
| outbox | eventos DEAD o backlog creciente | SEV2 |

No alertar por cada 404 de usuario. Los umbrales deben ajustarse con tráfico real.

## API down

1. Confirmar frontend, `/api/v1/health` y `/api/v1/health/ready` desde fuera de Railway.
2. Revisar último deployment y logs JSON por `requestId`/status 5xx.
3. Si liveness falla tras un deploy, rollback de aplicación al SHA conocido.
4. Si liveness está bien y readiness falla, seguir “Database unavailable”.
5. No ejecutar migrations otra vez sin revisar el estado.

## Database unavailable

1. Confirmar readiness y estado Railway PostgreSQL.
2. Revisar conexiones, límites de pool, almacenamiento y maintenance events.
3. Evitar reinicios repetidos que amplifiquen conexiones.
4. Si hay pérdida/corrupción, seguir `docs/disaster-recovery.md`.
5. Tras recuperar, comprobar migrations, pedidos pendientes, reservas, pagos y outbox.

## Payment webhook failing

1. Correlacionar `payment.webhook.received`, `validated` o error mediante request ID y provider event ID.
2. Verificar URL HTTPS, secreto, timestamp/firma y disponibilidad de API; nunca pegar el secreto en logs.
3. Mantener el webhook idempotente; no editar pagos manualmente.
4. Ejecutar de forma controlada `corepack pnpm payments:reconcile` en el environment afectado.
5. Confirmar AuditLog, PaymentProviderEvent, Payment/Order y reserva.

## Reservation cron failing

1. Revisar última ejecución de `reservation-expiry`.
2. Corregir conectividad/configuración.
3. Ejecutar una vez `corepack pnpm reservations:expire` como Railway one-off.
4. Confirmar resultado estructurado y que el proceso termina con código 0.
5. No liberar reservas desde el navegador ni mediante SQL improvisado.

## Reconciliation failing

1. Revisar `payment.reconciliation.failed` sin exponer payloads secretos.
2. Determinar si es outage/transitorio, credencial TEST/LIVE equivocada o dato inválido.
3. El job solo consulta pagos recientes no terminales y es seguro para repetir.
4. Reintentar como one-off después de corregir la causa.
5. Escalar si el mismo payment sigue fallando o existe divergencia de dinero/Order.

## Email failing

1. Revisar backlog `PENDING`/`PROCESSING`, `attempts`, `next_attempt_at` y eventos `DEAD`.
2. Verificar provider, dominio/remitente y estado Resend.
3. Corregir configuración y ejecutar `corepack pnpm outbox:process`.
4. No revertir Payment/Order: la notificación es efecto secundario.
5. La clave idempotente evita entrega repetida dentro de la ventana del provider.

## Mercado Pago outage

1. Mantener API/readiness arriba; readiness no consulta al provider.
2. Informar que el pago puede continuar pendiente.
3. No aprobar ni rechazar manualmente por el return URL.
4. Vigilar webhooks y reconciliation; reanudar el job al recuperarse el provider.
5. Cancelar una order solo mediante acción de dominio autorizada.

## Rollback de aplicación

1. Identificar último SHA compatible con el schema actual.
2. Usar rollback/redeploy Railway y Cloudflare al mismo SHA cuando sea posible.
3. Ejecutar smoke y observar logs.
4. No confundir rollback de aplicación con rollback de database.

## Rollback/restore de base

Una migration destructiva no tiene rollback trivial. Detener y seguir `docs/disaster-recovery.md`. Preferir forward fix compatible. Toda restauración se valida primero en una base aislada.

## Revocar sesiones

Para una identidad comprometida, desde una consola DB auditada y usando IDs verificados:

```sql
UPDATE sessions
SET revoked_at = now(), revocation_reason = 'security_response'
WHERE user_id = '<USER_UUID>' AND revoked_at IS NULL;
```

Para revocación global, rotar `SESSION_SECRET` invalida cookies pero requiere incidente SEV1, coordinación y nuevo deploy. No usar como operación rutinaria.

## Rotar secretos

1. Identificar consumidores y efecto de invalidación.
2. Generar valor independiente en el secret manager.
3. Para webhook/provider, coordinar ambos extremos y ventana de transición si existe.
4. Actualizar staging y probar primero.
5. Actualizar production mediante approval, redeploy y smoke.
6. Revocar el valor anterior y registrar responsable/fecha, nunca el valor.

## Escalamiento y cierre

Escalar SEV1 inmediatamente al owner técnico y de negocio. Al cerrar: documentar causa, línea de tiempo, impacto, recuperación, datos reconciliados y acciones con responsable/fecha.
