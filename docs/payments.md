# Pagos de Fase 4

Estado: implementado con `PaymentProvider` fake para CI y adapter Mercado Pago Orders API para sandbox. La validación real con Mercado Pago queda pendiente hasta cargar credenciales TEST y desplegar staging HTTPS. Corte: 12 de septiembre de 2026. LIVE no está activado.

## Decisión

CH Market usa checkout alojado de Mercado Pago mediante Orders API:

- creación: `POST https://api.mercadopago.com/v1/orders`;
- redirección: `checkout_url` retornado por Mercado Pago;
- consulta autoritativa: `GET https://api.mercadopago.com/v1/orders/{id}`;
- reembolso total: `POST https://api.mercadopago.com/v1/orders/{order_id}/refund`;
- notificaciones: tópico `Order`, `type: "order"`.

No se mezcla con Preferences API. `checkout_url` y `config.online.*_url` pertenecen a Orders API; `init_point` y `back_urls` pertenecen al flujo antiguo.

Fuentes oficiales usadas:

- https://www.mercadopago.cl/developers/en/docs/checkout-pro-orders/create-order
- https://www.mercadopago.cl/developers/en/docs/checkout-pro-orders/integration-test/test-purchase-with-card
- https://www.mercadopago.cl/developers/es/docs/checkout-api-orders/notifications
- https://www.mercadopago.cl/developers/en/docs/checkout-api-orders/optional-notifications
- https://www.mercadopago.cl/developers/en/reference/online-payments/checkout-api/refund-order/post
- https://www.mercadopago.cl/developers/en/docs/checkout-api-orders/payment-management/refunds-cancellations

## Arquitectura

```text
React checkout
-> POST /api/v1/checkout
-> CheckoutService
-> PaymentProvider
   -> FakePaymentProvider
   -> MercadoPagoPaymentProvider
-> PostgreSQL
```

El dominio no conoce DTOs crudos de Mercado Pago. El adapter normaliza estados externos a estados internos:

```text
CREATED, PENDING, APPROVED, REJECTED, CANCELLED, REFUNDED, ERROR
```

## Configuración

Variables nuevas:

```text
PAYMENT_PROVIDER
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
PAYMENT_SUCCESS_URL
PAYMENT_FAILURE_URL
PAYMENT_PENDING_URL
PAYMENT_WEBHOOK_URL
CHECKOUT_RESERVATION_MINUTES
```

El Access Token y el secreto de webhook son secretos de backend. No van en React, contratos, logs, fixtures ni commits.

## Checkout

`POST /api/v1/checkout` requiere customer autenticado, CSRF e `Idempotency-Key`. El request solo contiene:

```json
{
  "items": [{ "productId": "uuid", "quantity": 1 }],
  "fulfillmentMethod": "PICKUP",
  "notes": "opcional"
}
```

El backend:

1. deriva customer/tenant desde sesión;
2. recarga productos activos/publicados;
3. calcula precios y totales CLP enteros;
4. bloquea stock y crea reservas;
5. crea `Order PENDING_PAYMENT`, `OrderItem`, `Payment` y `PaymentAttempt`;
6. llama al provider fuera de la transacción local;
7. persiste provider IDs y `checkoutUrl`;
8. responde con `CheckoutResponse`.

El frontend redirige al `checkoutUrl` recibido. No construye URLs del proveedor.

## Webhooks y reconciliación

`POST /api/v1/webhooks/mercadopago` valida firma con `MERCADOPAGO_WEBHOOK_SECRET`, deduplica eventos y consulta el provider antes de aplicar efectos de negocio.

La URL de retorno `/checkout/resultado` es solo UX. Un query param como `status=approved` no cambia `Payment` ni `Order`.

El comando `pnpm payments:reconcile` protege ante webhooks perdidos. Solo selecciona pagos no terminales recientes, con umbral de antigüedad y lote máximo; consulta el provider y usa la misma reconciliación idempotente/auditada que el webhook. Railway lo programa cada cinco minutos.

El frontend conserva temporalmente en `sessionStorage` únicamente el ID de su order y `reservationExpiresAt`; consulta el endpoint customer con polling cada cuatro segundos por un máximo de dos minutos. El reloj es informativo: al llegar a cero se vuelve a consultar backend y nunca se libera stock desde React.

## Refunds

Staff con `orders.refund` puede ejecutar full refund desde detalle de pedido. La acción requiere motivo, confirmación, CSRF e idempotencia.

El refund no devuelve stock automáticamente. Si el producto vuelve físicamente, se registra después mediante un movimiento de inventario separado.

## Sandbox real

Antes de producción se debe validar manualmente con una aplicación Mercado Pago real:

- credenciales de prueba;
- `POST /v1/orders` con CLP/Chile;
- redirección `checkout_url`;
- pago aprobado, pendiente y rechazado;
- webhook firmado, duplicado y fuera de orden;
- `GET /v1/orders/{id}` como fuente autoritativa;
- full refund idempotente;
- URLs HTTPS públicas.

No se incluyen cobros productivos ni credenciales reales en el repositorio.

La evidencia de staging debe registrarse en `docs/staging-validation.md` y el gate LIVE está en `docs/go-live-payments.md`.
