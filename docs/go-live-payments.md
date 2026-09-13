# Gate de activación de pagos LIVE

## Estado

```text
LIVE PAYMENTS: NOT ACTIVATED
GATE: BLOCKED
```

Auditoría Fase 5B: 12 de septiembre de 2026.

Este archivo no autoriza cobros. Fase 5B valida únicamente sandbox TEST y preparación operativa; activar dinero real requiere otra instrucción explícita del owner.

## Evidencia obligatoria

| Gate | Estado actual |
| --- | --- |
| staging Railway/Cloudflare/PostgreSQL HTTPS | BLOCKED |
| credenciales Mercado Pago TEST separadas | BLOCKED |
| seller y buyer TEST Chile | BLOCKED |
| checkout_url/Order TEST válida | BLOCKED |
| approved, pending y rejected | BLOCKED |
| cancelación/retry | BLOCKED |
| full refund | BLOCKED |
| webhook HTTPS `order` firmado | BLOCKED |
| firma inválida, duplicado y fuera de orden | BLOCKED |
| reconciliation recupera webhook perdido | BLOCKED |
| return URL no autoritativa | PASS local / BLOCKED proveedor |
| price authority, ownership y tenant isolation | PASS local / BLOCKED staging |
| cron de reservations/reconciliation | BLOCKED |
| backup y restore drill con RPO/RTO | BLOCKED |
| logs, monitoring y alertas | BLOCKED |
| Resend/outbox real | BLOCKED |
| textos legales y datos productivos | BLOCKED |
| personal entrenado y runbook aceptado | BLOCKED |
| credenciales productivas creadas/almacenadas | NOT APPLICABLE en Fase 5B |
| activación LIVE | NOT APPLICABLE en Fase 5B |

FakePaymentProvider y los tests locales no reemplazan ningún gate Mercado Pago TEST.

## Requisitos actuales del proveedor revisados

La revisión de documentación oficial vigente confirmó:

- Checkout API procesa pagos mediante Orders en `POST /v1/orders`;
- `Authorization` y `X-Idempotency-Key` son requeridos;
- seller y buyer TEST deben usar cuentas de prueba compatibles y del mismo país;
- los eventos “Order (Mercado Pago)” se envían a una URL HTTPS;
- la autenticidad del webhook se valida con la clave secreta y `x-signature`;
- creación, cancelación y reembolso deben probarse antes de producción.

Los enlaces de referencia y resultados concretos se registran en `docs/staging-validation.md`. No se almacenan credenciales ni datos de acceso de cuentas TEST.

## MANUAL OWNER ACTION REQUIRED

Solo después de cerrar todos los BLOCKED:

1. aprobar la evidencia TEST de `docs/staging-validation.md`;
2. aprobar textos legales, datos reales, restore drill, monitoreo y alertas;
3. crear una ventana de cambio;
4. confirmar backup reciente y rollback de aplicación;
5. mostrar target environment, host de DB redactado y organization, sin secretos;
6. obtener una autorización explícita y separada para LIVE;
7. configurar secretos LIVE directamente en Railway production;
8. definir `PAYMENT_PROVIDER=mercadopago` mediante cambio revisado;
9. desplegar desde `main` con approval del GitHub Environment `production`;
10. ejecutar compra/refund controlados y observar webhook, DB, inventario, email y reconciliation.

Ante cualquier divergencia, volver a `PAYMENT_PROVIDER=fake` no revierte operaciones ya creadas. Conciliar primero pagos existentes y seguir `docs/operations-runbook.md`.

## Resultado Fase 5B

```text
MERCADO PAGO TEST: BLOCKED — NOT EXECUTED
FASE 4: 95%
LIVE PAYMENTS: NOT ACTIVATED
```
