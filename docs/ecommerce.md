# Ecommerce de Fase 4

## Reglas aplicadas

- Checkout requiere sesión customer; el navegador no envía `customerId`.
- El servidor recarga productos, precios, publicación, actividad y stock antes de crear la order.
- CLP se conserva como entero. No se implementan descuentos, impuestos, despacho ni mínimo de compra.
- El único fulfillment habilitado es `PICKUP`.
- La order nace `PENDING_PAYMENT` antes de redirigir al proveedor.
- La URL de retorno `/checkout/resultado` es solo experiencia visual; no cambia estados.
- La pantalla de retorno consulta el pedido de la sesión con polling limitado y muestra el TTL solo como referencia.

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

## Notificaciones

Bienvenida, pedido creado, pago aprobado, listo para retiro, cancelación y refund producen `OutboxEvent` dentro de la transacción principal. Un cron entrega mediante provider fake o Resend. El email no bloquea ni revierte el flujo comercial.

## Límites

No incluye pagos productivos, promociones, despacho, facturación, devoluciones físicas, WhatsApp/SMS, couriers ni uploads de imágenes.
