# API HTTP v1 de TraceLink

## Contrato común

- Base local: `http://127.0.0.1:3001/api/v1`.
- El navegador usa normalmente `/api/v1` mediante el proxy de Vite.
- JSON estricto en requests/responses, salvo `204 No Content`.
- Cookie de sesión HttpOnly; toda request frontend usa `credentials: include`.
- Cada respuesta expone `X-Request-ID`.
- Toda mutación autenticada exige `X-CSRF-Token` y Origin exacto.
- Inventario, checkout, reintentos/cancelación/reembolsos de pago, transiciones/cancelación de pedidos y recepción/transición/entrega de paquetes exigen `Idempotency-Key`.
- Arrays de filtros se envían como parámetros repetidos.
- Listas responden `{ items, page, pageSize, totalItems, totalPages }`, con `pageSize <= 100`.

Los schemas citados viven en `@tracelink/contracts`. El mapa método-a-método con campos y reglas de ownership está en [api-contract-map.md](api-contract-map.md).

## Autenticación y salud

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores esperados |
| --- | --- | --- | --- | --- |
| `GET /health/live` | Público | Sin entrada | Estado application `up`, `200` | — |
| `GET /health/ready` | Público | Sin entrada | Estado application/database, `200` o `503` | `503` con estado `not_ready` si DB no responde |
| `GET /health` | Público | Sin entrada | Liveness application `up`, `200` | — |
| `POST /auth/login` | Anónimo + Origin + rate limit | `SignInRequest` | `AuthSessionEnvelope`, cookie, `200` | `400`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`, `429` |
| `POST /auth/register` | Anónimo + Origin + rate limit | `RegisterRequest` customer | `AuthSessionEnvelope`, cookie, `201` | `400`, `409`, `429` |
| `GET /auth/me` | Sesión | Sin entrada | `AuthSessionEnvelope`, `200` | `401`, `SESSION_EXPIRED` |
| `POST /auth/logout` | Sesión + CSRF | Sin body | Cookie expirada, `204` | `401`, `403 CSRF_INVALID` |

`AuthSessionEnvelope` contiene la identidad/tenant/audiencia visible y un token CSRF; nunca contiene el token de sesión ni un password hash.

## Productos

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /products` | Público | `ProductListParams` query | `ProductPage` | `400` |
| `GET /products/categories` | Público | Sin entrada | `ProductCategory[]` | — |
| `GET /products/:slug` | Público | slug | `Product` | `404` |
| `GET /products/:slug/related` | Público | slug + `limit?` | `Product[]` | `400`, `404` |
| `GET /staff/products` | Staff / `products.view` | `ProductAdminListParams` | `ProductPage` | `400`, `401`, `403` |
| `GET /staff/products/:id` | Staff / `products.view` | UUID | `Product` | `401`, `403`, `404` |
| `POST /staff/products` | Staff / `products.create` + CSRF | `ProductCommercialInput` | `Product`, `201` | `400`, `401`, `403`, `409` |
| `PATCH /staff/products/:id` | Staff / `products.update` + CSRF | UUID + `ProductCommercialInput` | `Product` | `400`, `401`, `403`, `404`, `409` |
| `PATCH /staff/products/:id/active` | Staff / `products.update` + CSRF | `{ active }` | `Product` | `400`, `401`, `403`, `404` |
| `PATCH /staff/products/:id/publication` | Staff / `products.update` + CSRF | `{ published }` | `Product` | `400`, `401`, `403`, `404` |

Las lecturas públicas resuelven el tenant configurado y solo muestran productos activos/publicados. Las rutas staff derivan el tenant de la sesión.

## Clientes

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /me/profile` | Customer | Sin entrada | `Customer` | `401`, `403`, `404` |
| `PATCH /me/profile` | Customer + CSRF | `CustomerProfileInput` | `Customer` | `400`, `401`, `403`, `409` |
| `GET /staff/customers` | Staff / `customers.view` | `StaffCustomerListParams` | `StaffCustomerPage` | `400`, `401`, `403` |
| `GET /staff/customers/:id` | Staff / `customers.view` | UUID | `StaffCustomerDetail` | `401`, `403`, `404` |
| `PATCH /staff/customers/:id` | Staff / `customers.update` + CSRF | `StaffCustomerUpdateInput` | `StaffCustomerDetail` | `400`, `401`, `403`, `404`, `409` |

Las rutas `/me` obtienen `customerId` exclusivamente de la sesión.

## Inventario

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /staff/inventory` | Staff / `inventory.view` | `InventoryListParams` | `InventoryPage` | `400`, `401`, `403` |
| `GET /staff/inventory/categories` | Staff / `inventory.view` | Sin entrada | `InventoryCategory[]` | `401`, `403` |
| `GET /staff/inventory/:id` | Staff / `inventory.view` | UUID balance | `InventoryItem` | `401`, `403`, `404` |
| `GET /staff/inventory/movements` | Staff / `inventory.view` | `InventoryMovementListParams` | `InventoryMovementPage` | `400`, `401`, `403` |
| `POST /staff/inventory/movements` | Staff / `inventory.adjust` + CSRF + idempotencia | `CreateInventoryMovementRequest` | `InventoryMovement`, `201` | `400`, `401`, `403`, `404`, `409 INSUFFICIENT_STOCK/IDEMPOTENCY_CONFLICT` |

El request nunca fija stock absoluto; el servidor bloquea el balance, calcula el delta y escribe balance, ledger y auditoría atómicamente.

## Checkout y pagos

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `POST /checkout` | Customer + CSRF + idempotencia | `CreateCheckoutRequest` con `items`, `fulfillmentMethod: "PICKUP"` y `notes?` | `CheckoutResponse`, `201` | `400`, `401`, `403`, `404`, `409 INSUFFICIENT_STOCK/IDEMPOTENCY_CONFLICT`, `502 PAYMENT_PROVIDER_UNAVAILABLE` |
| `POST /webhooks/mercadopago` | Público + firma proveedor | Body Mercado Pago Orders + headers `x-signature`, `x-request-id` | `{ received: true }` | `400`, `403 INVALID_WEBHOOK_SIGNATURE` |

`POST /checkout` nunca acepta `customerId`, precios, descuentos, impuestos ni despacho desde el navegador. El servidor recalcula CLP enteros, crea `Order PENDING_PAYMENT`, reserva inventario por el TTL configurado, crea `Payment` y `PaymentAttempt`, llama al `PaymentProvider` fuera de la transacción local y devuelve el `checkoutUrl` recibido del proveedor.

La URL de retorno `/checkout/resultado` pertenece al frontend y no es un endpoint autoritativo de API. El cambio de estado real ocurre por webhook/reconciliación consultando el provider.

## Pedidos

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /me/orders` | Customer | `OrderListParams` | `OrderPage` | `400`, `401`, `403` |
| `GET /me/orders/:id` | Customer owner | UUID | `Order` | `401`, `403`, `404` |
| `POST /me/orders/:id/payment-attempts` | Customer owner + CSRF + idempotencia | Sin body | `PaymentRetryResponse`, `201` | `400`, `401`, `403`, `404`, `409` |
| `POST /me/orders/:id/cancellation` | Customer owner + CSRF + idempotencia | `{ reason }` | `CustomerOrderCancellationResponse` | `400`, `401`, `403`, `404`, `409` |
| `GET /staff/orders` | Staff / `orders.view` | `StaffOrderListParams` | `StaffOrderPage` | `400`, `401`, `403` |
| `GET /staff/orders/:id` | Staff / `orders.view` | UUID | `StaffOrder` | `401`, `403`, `404` |
| `POST /staff/orders/:id/transitions` | Staff / `orders.update` + CSRF + idempotencia | `{ toStatus }` | `StaffOrder` | `400`, `401`, `403`, `404`, `409 INVALID_STATE_TRANSITION/IDEMPOTENCY_CONFLICT` |
| `POST /staff/orders/:id/cancellation` | Staff / `orders.cancel` + CSRF + idempotencia | `{ reason }` | `StaffOrder` | `400`, `401`, `403`, `404`, `409` |
| `POST /staff/orders/:id/refunds` | Staff / `orders.refund` + CSRF + idempotencia | `{ reason }` | `FullRefundResponse` | `400`, `401`, `403`, `404`, `409` |

`StaffOrderListParams` permite filtrar por estado de order, estado de pago, `paymentProviders` (`MERCADOPAGO`/`FAKE`), fulfillment y rango de fechas. El filtro se aplica en PostgreSQL con tenant obligatorio.

`CANCELLED` solo se alcanza por cancellation; customer solo puede cancelar `PENDING_PAYMENT`. El pago aprobado habilita `PAID -> PREPARING -> READY -> COMPLETED`; `COMPLETED` consume stock reservado. El reembolso actual es total; no genera devolución física de stock.

## Paquetes

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /me/packages` | Customer | `PackageListParams` | `PackagePage` | `400`, `401`, `403` |
| `GET /me/packages/:id` | Customer owner | UUID | `CustomerPackage` | `401`, `403`, `404` |
| `GET /staff/package-customer-options` | Staff / `packages.receive` | búsqueda paginada | `PackageCustomerOptionPage` | `400`, `401`, `403` |
| `GET /staff/packages` | Staff / `packages.view` | `StaffPackageListParams` | `StaffPackagePage` | `400`, `401`, `403` |
| `GET /staff/packages/:id` | Staff / `packages.view` | UUID | `StaffPackage` | `401`, `403`, `404` |
| `POST /staff/packages` | Staff / `packages.receive` + CSRF + idempotencia | `ReceivePackageRequest` | `StaffPackage`, `201` | `400`, `401`, `403`, `404`, `409` |
| `POST /staff/packages/:id/transitions` | Staff / `packages.update` + CSRF + idempotencia | `TransitionPackageRequest` | `StaffPackage` | `400`, `401`, `403`, `404`, `409 INVALID_STATE_TRANSITION` |
| `POST /staff/packages/:id/delivery` | Staff / `packages.deliver` + CSRF + idempotencia + rate limit | `DeliverPackageRequest` | `StaffPackage` | `400`, `401`, `403`, `404`, `409 PICKUP_CODE_INVALID/IDEMPOTENCY_CONFLICT`, `429` |

`PICKED_UP` solo se alcanza por delivery. El código se compara con su hash y se consume; nunca se devuelve el hash.

## Usuarios y roles

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /staff/users` | Staff / `users.view` | `StaffUserListParams` | `StaffUserPage` | `400`, `401`, `403` |
| `GET /staff/users/:id` | Staff / `users.view` | Membership UUID | `StaffUser` | `401`, `403`, `404` |
| `PATCH /staff/users/:id/access` | Staff / `users.manage` + CSRF | `{ status, roleId }` | `StaffUser` | `400`, `401`, `403`, `404`, `409` |
| `GET /staff/roles` | Staff / `users.view` | Sin entrada | `StaffRoleDefinition[]` | `401`, `403` |
| `GET /staff/roles/:id` | Staff / `users.view` | Role UUID | `StaffRoleDefinition` | `401`, `403`, `404` |
| `PUT /staff/roles/:id/permissions` | Staff / `users.manage` + CSRF | `{ permissions }` | `StaffRoleDefinition` | `400`, `401`, `403`, `404`, `409` |

Deshabilitar una Membership revoca sus sesiones de esa organización. Los permisos solo pueden pertenecer al catálogo tipado.

## Dashboard, reportes y settings

| Método y endpoint | Auth / permiso | Request | Respuesta | Errores |
| --- | --- | --- | --- | --- |
| `GET /staff/dashboard` | Staff activo | Sin entrada | `DashboardOverview` | `401`, `403` |
| `GET /staff/reports` | Staff / `reports.view` | `ReportListParams` | `OperationalReport` | `400`, `401`, `403` |
| `GET /staff/settings` | Staff / `settings.manage` | Sin entrada | `OrganizationSettings` | `401`, `403`, `404` |
| `PUT /staff/settings` | Staff / `settings.manage` + CSRF | `OrganizationSettingsInput` | `OrganizationSettings` | `400`, `401`, `403`, `409` |

Dashboard/reportes se derivan de datos persistidos; settings es un único agregado HTTP aunque escriba Organization y OrganizationSettings.

## Errores

Formato estable:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud no es válida.",
    "fieldErrors": { "body.email": ["Correo inválido"] }
  },
  "requestId": "request-id"
}
```

Códigos contractuales: `VALIDATION_ERROR`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `SESSION_EXPIRED`, `FORBIDDEN`, `ORIGIN_NOT_ALLOWED`, `CSRF_INVALID`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `DATABASE_UNAVAILABLE`, `INVALID_STATE_TRANSITION`, `INSUFFICIENT_STOCK`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `PICKUP_CODE_INVALID` e `INTERNAL_ERROR`.

Un error 500 no expone stack. El `requestId` del body coincide con `X-Request-ID`.

## Replay idempotente

Una respuesta reproducida conserva status/body y agrega `Idempotency-Replayed: true`. La clave debe representar el intento lógico: el frontend puede reutilizarla cuando desconoce el resultado de red, pero debe crear una nueva para una operación distinta.
