# Arquitectura backend de TraceLink V2

## Alcance

La API de Fase 3 convierte PostgreSQL en la fuente autoritativa de CH Market sin reconstruir las pantallas de Fase 2. El checkout continúa siendo visual y no crea pagos ni reservas desde el navegador.

El flujo principal es:

```text
React page
  -> feature hook / use case
  -> frontend service contract
  -> Mock adapter o HTTP adapter
  -> /api/v1
  -> route / middleware
  -> controller
  -> domain service
  -> tenant-scoped repository
  -> PostgreSQL 18
```

## Componentes del workspace

- `apps/web`: React, router, UX y adapters mock/HTTP.
- `apps/api`: Express 5, autenticación, reglas de negocio y repositories PostgreSQL.
- `packages/contracts`: schemas Zod y tipos de request/response compartidos. No exporta modelos Prisma.
- `apps/api/prisma/contract.prisma`: contrato relacional Prisma 8.
- `apps/api/migrations`: migraciones versionadas y snapshots del contrato.
- `docker-compose.yml`: PostgreSQL 18 para desarrollo y un perfil separado para pruebas.

La API usa TypeScript estricto y módulos orientados al dominio. Cada módulo sigue `route -> controller -> service -> repository`; los controllers validan y traducen HTTP, mientras que las reglas críticas permanecen en services/repositories.

## Bootstrap y ciclo de vida

`src/server.ts` valida el entorno, crea el pool PostgreSQL, ensambla Express y gestiona cierre ordenado. `src/app.ts` instala, en este orden, request ID, logging estructurado, Helmet, CORS exacto, validación de Origin, límite JSON, rutas y manejo común de errores.

Health checks:

- `GET /api/v1/health/live`: confirma que el proceso responde.
- `GET /api/v1/health/ready`: prueba conectividad real con PostgreSQL.
- `GET /api/v1/health`: resume vida y disponibilidad de la base.

## Contexto autoritativo

La organización pública se resuelve mediante `ORGANIZATION_SLUG`. En rutas autenticadas, la sesión resuelve `organizationId`, `userId`, audiencia y, según corresponda, `customerId` o `membershipId` con rol y permisos.

La API nunca toma `organizationId`, actor ni ownership desde body/query. Los repositories reciben el tenant explícitamente y las relaciones de negocio usan claves foráneas compuestas con `organizationId`. Una búsqueda privada fuera de tenant o de customer produce el mismo `404` que un ID inexistente.

## Contratos y validación

Los límites HTTP se validan con Zod desde `@tracelink/contracts`:

```text
modelo PostgreSQL != DTO de API != view model del frontend
```

Las respuestas también se validan antes de salir de repositories/adapters. Las listas usan paginación común con `items`, `page`, `pageSize`, `totalItems` y `totalPages`; los filtros array usan parámetros repetidos.

## Límites transaccionales

| Operación | Trabajo atómico |
| --- | --- |
| Registro customer | User, Customer y Session de la organización. |
| Producto | Alta/edición/cambio de estado más AuditLog. |
| Perfil customer | Actualización tenant/owner-scoped más AuditLog. |
| Movimiento de inventario | Reserva idempotente, bloqueo del balance, validación de cantidades, actualización del balance, ledger inmutable y AuditLog. |
| Reserva de inventario | Bloqueo de balance, cambio de reservado, alta/cambio de estado de reserva y AuditLog. |
| Transición/cancelación de pedido | Reserva idempotente, bloqueo del pedido, validación de state machine, actualización, OrderStatusEvent y AuditLog. |
| Recepción/transición/entrega de paquete | Reserva idempotente, validaciones tenant/owner, actualización, TrackingEvent y AuditLog; la entrega además consume el hash y crea PackagePickupReceipt. |
| Acceso de usuario | Cambio de Membership/Role, revocación de sesiones cuando corresponde y AuditLog. |
| Permisos de rol | Reemplazo validado de RolePermission y AuditLog. |
| Settings | Organization + OrganizationSettings + AuditLog. |

Las mutaciones idempotentes almacenan un HMAC de la clave y del request. La misma clave con el mismo payload reproduce status/body; una reutilización con otro payload devuelve `409 IDEMPOTENCY_CONFLICT`. Los registros vencidos se eliminan oportunistamente.

## Inventario

`InventoryBalance` materializa únicamente cantidades físicas y reservadas; el disponible se deriva. Todos los cambios físicos crean un `InventoryMovement` inmutable con snapshots anterior/posterior. El balance se bloquea dentro de la transacción y la base impide cantidades negativas o `reserved > physical`.

`InventoryReservation` está implementado y probado como dominio persistente (`ACTIVE`, `CONSUMED`, `RELEASED`, `EXPIRED`), pero no está conectado al checkout de Fase 3.

## Pedidos y paquetes

Las transiciones de pedidos y paquetes se validan nuevamente en servidor. Los eventos y la auditoría se escriben en la misma transacción que el estado. Customer y staff consultan las mismas tablas, por lo que observan una única realidad persistida.

`PICKED_UP` solo se alcanza mediante la acción de entrega, y `CANCELLED` mediante cancelación. El código de retiro nunca se almacena en texto plano: se compara por HMAC, tiene expiración y se consume al entregar.

## Lecturas derivadas

Dashboard y reportes calculan KPIs y filas desde productos, inventario, pedidos, paquetes y settings persistidos. No existen tablas de KPIs como segunda fuente de verdad. La exportación CSV continúa en el frontend sobre datos autoritativos y conserva su neutralización de fórmulas.

## Decisiones aplazadas

Fase 3 no incluye pagos, checkout real, webhooks, notificaciones, couriers, uploads, Redis, colas ni microservicios. Optimistic concurrency para ediciones administrativas no críticas y el canal de provisión del código de retiro quedan como trabajo posterior explícito.
