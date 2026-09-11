# Ecommerce de Fase 4

## Reglas aplicadas

- Checkout requiere sesión customer; el navegador no envía `customerId`.
- El servidor recarga productos, precios, publicación, actividad y stock antes de crear la order.
- CLP se conserva como entero. No se implementan descuentos, impuestos, despacho ni mínimo de compra.
- El único fulfillment habilitado es `PICKUP`.
- La order nace `PENDING_PAYMENT` antes de redirigir al proveedor.
- La URL de retorno `/checkout/resultado` es solo experiencia visual; no cambia estados.

## Flujo principal

```text
cart
-> POST /api/v1/checkout
-> reserva transaccional
-> Order PENDING_PAYMENT
-> Payment + PaymentAttempt
-> PaymentProvider.createCheckout
-> checkoutUrl
-> webhook firmado
-> consulta provider
-> Payment APPROVED
-> Order PAID
-> reservations COMMITTED
-> staff fulfillment
-> Order COMPLETED + InventoryMovement SALE
```

## Customer

El portal customer puede:

- ver pedidos reales ligados a su sesión;
- volver al `checkoutUrl` vigente;
- crear un nuevo intento de pago sobre la misma order;
- cancelar pedidos `PENDING_PAYMENT`, liberando reserva y cancelando pago local.

## Staff

Staff procesa pedidos pagados con la state machine:

```text
PAID -> PREPARING -> READY -> COMPLETED
```

En `COMPLETED` el backend consume reservas comprometidas y crea movimientos `SALE` de forma idempotente. Staff con `orders.refund` puede ejecutar full refund con motivo y confirmación; el refund no devuelve stock automáticamente.

## Límites

No incluye pagos productivos, promociones, despacho, facturación, devoluciones físicas, notificaciones, couriers ni uploads de imágenes.
