# Reservas de inventario de Fase 4

## Lifecycle

```text
ACTIVE     checkout pendiente
COMMITTED  pago aprobado
CONSUMED   fulfillment completado
RELEASED   pago rechazado/cancelado o cancelación customer
EXPIRED    TTL vencido por job
```

## Invariantes

- `available = physical_quantity - reserved_quantity`.
- El disponible no se persiste como verdad independiente.
- La base impide `reserved_quantity > physical_quantity`.
- Reservar incrementa solo `reserved_quantity`.
- Pago aprobado no descuenta físico.
- Fulfillment `COMPLETED` descuenta físico y reservado, y registra `InventoryMovement SALE`.
- Refund no genera retorno de stock; una devolución física futura debe registrarse como movimiento separado.

## Concurrencia

La asignación bloquea balances en PostgreSQL dentro de la transacción de checkout. Si dos customers compiten por la misma unidad disponible, solo una transacción puede incrementar el reservado. La otra falla con stock insuficiente.

## FEFO

Cuando existen lotes, la reserva prioriza:

```text
expiration_date ASC NULLS LAST
created_at ASC
```

Una línea puede dividirse en varios balances/lotes cuando el stock disponible está repartido.

## Expiración

El comando:

```powershell
corepack pnpm reservations:expire
```

ejecuta el servicio idempotente de expiración. Libera reservas `ACTIVE` vencidas y resta las cantidades reservadas correspondientes. El cron productivo queda para Fase 5.
