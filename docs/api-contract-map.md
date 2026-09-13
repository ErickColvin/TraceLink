# TraceLink V2 - mapa de contratos frontend/API

Estado: contrato estable de Fase 4, implementado por la API y los adapters HTTP.

Este documento traduce los servicios del frontend a la API HTTP v1. La API conserva DTOs visibles para pantallas cuando es seguro hacerlo, y deja las diferencias de persistencia dentro de adaptadores. Los modelos Prisma no forman parte del contrato público.

## Convenciones

- Prefijo estable: `/api/v1`.
- JSON estricto salvo `204 No Content`.
- La organización pública se resuelve por configuración; nunca por `organizationId` enviado por el navegador.
- Rutas `/me` derivan `userId`, `customerId` y `organizationId` de la sesión.
- Rutas `/staff` derivan `userId`, `membershipId`, rol, permisos y `organizationId` de la sesión.
- Recursos ajenos al tenant o customer responden `404 NOT_FOUND`.
- Toda mutación autenticada por cookie exige Origin permitido y `X-CSRF-Token`.
- `Idempotency-Key` es obligatorio para checkout, inventario, payment retry, cancelación, refund, recepción/transición/entrega de paquetes y transiciones de pedidos.
- Arrays de filtros se serializan como parámetros repetidos.
- Cada respuesta incluye `X-Request-Id`; los errores incluyen el mismo `requestId` en el cuerpo.

## AuthService

| Service method | HTTP | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| `getSession()` | `GET /auth/me` | Sin body | `AuthSessionEnvelope` | Cookie opcional |
| `signIn(credentials)` | `POST /auth/login` | `SignInRequest` | `AuthSessionEnvelope` | Anónimo + Origin + rate limit |
| `register(input)` | `POST /auth/register` | `RegisterRequest` | `AuthSessionEnvelope` | Anónimo + Origin + rate limit |
| `startDemoSession(audience)` | Sin endpoint | Mock only | `AuthenticatedSession` mock | No aplica |
| `signOut()` | `POST /auth/logout` | Sin body | `204` | Sesión + CSRF |

Registro crea `User + Customer` en el tenant configurado. Nunca permite elegir rol, tenant ni permisos.

## CheckoutService

| Service method | HTTP | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| `submit(input, options)` | `POST /checkout` | `CreateCheckoutRequest` + `Idempotency-Key` | `CheckoutResponse` | Customer + CSRF |

`CreateCheckoutRequest` contiene `items`, `fulfillmentMethod: "PICKUP"` y `notes?`. El navegador no envía precio, stock, descuento, impuesto, despacho ni `customerId`. El backend recalcula totales, crea `Order PENDING_PAYMENT`, reserva inventario y devuelve el `checkoutUrl` recibido del `PaymentProvider`.

## OrderService customer

| Service method | HTTP | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| `listCurrentCustomer(params?)` | `GET /me/orders` | `OrderListParams` | `OrderPage` | Customer |
| `getCurrentCustomerById(id)` | `GET /me/orders/:id` | Path id | `Order` | Customer owner |
| `retryPayment(id, options)` | `POST /me/orders/:id/payment-attempts` | Sin body + `Idempotency-Key` | `PaymentRetryResponse` | Customer owner + CSRF |
| `cancel(id, reason, options)` | `POST /me/orders/:id/cancellation` | `{ reason }` + `Idempotency-Key` | `CustomerOrderCancellationResponse` | Customer owner + CSRF |

Customer solo ve sus orders. Payment retry usa la misma order. Cancelación customer solo aplica en `PENDING_PAYMENT`.

## StaffOrderService

| Service method | HTTP | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| `list(params?)` | `GET /staff/orders` | `StaffOrderListParams` | `StaffOrderPage` | Staff `orders.view` |
| `getById(id)` | `GET /staff/orders/:id` | Path id | `StaffOrder` | Staff `orders.view` |
| `transitionStatus(input)` | `POST /staff/orders/:id/transitions` | `{ toStatus }` + `Idempotency-Key` | `StaffOrder` | Staff `orders.update` + CSRF |
| `cancel(input)` | `POST /staff/orders/:id/cancellation` | `{ reason }` + `Idempotency-Key` | `StaffOrder` | Staff `orders.cancel` + CSRF |
| `refund(input)` | `POST /staff/orders/:id/refunds` | `{ reason }` + `Idempotency-Key` | `FullRefundResponse` | Staff `orders.refund` + CSRF |

La state machine de fulfillment es `PAID -> PREPARING -> READY -> COMPLETED`. `COMPLETED` consume reservas comprometidas y escribe `InventoryMovement SALE` una vez. El refund actual es total y no devuelve stock automáticamente.

## Payment webhooks

| Endpoint | Auth | Resultado |
| --- | --- | --- |
| `POST /webhooks/mercadopago` | Firma provider + deduplicación | `{ received: true }` |

El webhook no confía en el body como autoridad. Valida firma, deduplica por `provider + providerEventId`, consulta el provider y reconcilia `Payment`, `Order` y `InventoryReservation` sin retroceder estados finales.

## Otros servicios HTTP

| Servicio | Métodos principales | Auth |
| --- | --- | --- |
| `ProductService` | público/staff para catálogo, detalle, creación, edición, publicación y activación | Público o staff `products.*` |
| `InventoryService` | listado, categorías, detalle y movimientos | Staff `inventory.view` / `inventory.adjust` |
| `PackageService` | paquetes customer | Customer owner |
| `StaffPackageService` | paquetes staff, recepción, tracking, entrega y opciones mínimas de customer | Staff `packages.*` |
| `CustomerSelfService` | perfil customer | Customer |
| `StaffCustomerService` | clientes staff | Staff `customers.*` |
| `UserService` | usuarios/memberships staff | Staff `users.*` |
| `RoleService` | roles y permisos | Staff `users.view` / `users.manage` |
| `DashboardService` | overview operacional | Staff activo |
| `ReportService` | reportes | Staff `reports.view` |
| `SettingsService` | settings de organización | Staff `settings.manage` |

Todos estos servicios siguen tenant-scoped. Las mutaciones derivan actor desde sesión y usan DTOs estrictos.

## Matriz de seguridad contractual

| Caso | Resultado estable |
| --- | --- |
| Sin cookie válida en ruta protegida | `401 UNAUTHENTICATED` |
| Customer intenta ruta staff | `403 FORBIDDEN` |
| Staff sin permiso | `403 FORBIDDEN` |
| ID de otro tenant/customer | `404 NOT_FOUND` |
| CSRF ausente/incorrecto | `403 CSRF_INVALID` |
| Origin no permitido | `403 ORIGIN_NOT_ALLOWED` |
| Campo `actor`/`organizationId`/`customerId` no autorizado | `400 VALIDATION_ERROR` |
| Transición fuera de state machine | `409 INVALID_STATE_TRANSITION` |
| Stock insuficiente | `409 INSUFFICIENT_STOCK` |
| Webhook sin firma válida | `403 INVALID_WEBHOOK_SIGNATURE` y sin efecto de negocio |
| Return URL con query `approved` | UX únicamente; no cambia estado |
| Misma idempotency key y mismo payload | Replay de status/body originales |
| Misma idempotency key y payload distinto | `409 IDEMPOTENCY_CONFLICT` |

Este mapa es la fuente de verdad para schemas compartidos, controllers, adaptadores HTTP y pruebas contractuales de Fase 4.
