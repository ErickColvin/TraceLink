# Gate de activación de pagos LIVE

## Estado

**LIVE PAYMENTS: NOT ACTIVATED**

Este archivo no autoriza cobros. La activación exige aprobación explícita del owner después de completar todo el checklist.

## Evidencia obligatoria

- [ ] Credenciales productivas de Mercado Pago creadas y almacenadas solo en Railway Variables.
- [ ] Cuenta/comercio habilitado y requisitos de integración/certificación completados cuando correspondan.
- [ ] HTTPS y dominio productivo válidos.
- [ ] Success, failure y pending URLs productivas registradas.
- [ ] Webhook productivo HTTPS registrado con secreto distinto de staging.
- [ ] Todos los casos de `docs/staging-validation.md` aprobados con TEST credentials.
- [ ] Firma, timestamp, idempotencia, duplicados y notificaciones fuera de orden aprobados.
- [ ] Price authority, customer ownership y tenant isolation cubiertos.
- [ ] Full refund probado y permisos `orders.refund` revisados.
- [ ] Reconciliation job activo y alertas verificadas.
- [ ] Reservation cron activo.
- [ ] Backup y restore drill aprobados.
- [ ] Logs redactados, uptime monitor y alertas activos.
- [ ] Correo productivo y outbox validados.
- [ ] Textos legales y datos productivos aprobados.
- [ ] Personal entrenado y runbook accesible.

## MANUAL OWNER ACTION REQUIRED

Solo después de firmar la evidencia:

1. crear una ventana de cambio;
2. confirmar backup reciente;
3. reemplazar en Railway production los valores TEST por secretos LIVE, sin registrarlos;
4. definir `PAYMENT_PROVIDER=mercadopago`;
5. confirmar URLs productivas exactas;
6. desplegar mediante GitHub Environment `production` con approval;
7. realizar una compra controlada de monto mínimo autorizado;
8. verificar webhook, Order, Payment, reserva/inventario, correo y conciliación;
9. verificar refund controlado si el negocio lo autoriza;
10. vigilar logs/alertas y documentar el resultado.

Ante cualquier divergencia, volver `PAYMENT_PROVIDER=fake` no revierte operaciones ya creadas. Conciliar primero los pagos existentes y seguir el runbook.
