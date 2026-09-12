# Modelo de datos de TraceLink V2

## Tecnología y convenciones

TraceLink usa PostgreSQL 18 y un contrato Prisma 8 fijado por versión. El contrato vive en `apps/api/prisma/contract.prisma`; las migraciones versionadas y sus snapshots viven en `apps/api/migrations`.

Convenciones principales:

- UUID generados por PostgreSQL para identidades.
- `timestamptz` para instantes y `date` para vencimientos sin hora.
- importes CLP como `integer`, nunca coma flotante.
- `organization_id` en toda entidad de negocio.
- relaciones compuestas por tenant para impedir asociaciones cruzadas.
- checks de base para montos, cantidades, estados internos y hashes.
- `created_at`/`updated_at` en UTC; la presentación usa la zona de la organización.

## Identidad, tenant y acceso

### Organization

Raíz del tenant. Define nombre, slug, locale, moneda, zona horaria y estado. CH Market es la primera organización, pero ningún modelo de negocio depende de un ID codificado en la aplicación.

### User, Customer y Membership

`User` es la identidad global de login. `Customer` es el perfil comercial dentro de una organización y puede vincularse a un User. `Membership` representa el acceso de personal a una organización y apunta a un Role.

Esta separación evita un campo global `User.role` y permite que una identidad tenga perfiles o accesos distintos por tenant.

### Role, Permission y RolePermission

Los roles pertenecen a una organización. `Permission` es el catálogo estable tipado, incluyendo `orders.refund`, y `RolePermission` resuelve la relación muchos-a-muchos, incluyendo `organization_id` en su clave y foreign key al rol.

### Session

Conserva contexto de audiencia customer/staff, tenant y relación asociada. Solo guarda un hash HMAC-SHA-256 del token opaco, además de expiración absoluta, última actividad y revocación. Un check exige exactamente Customer o Membership según la audiencia.

## Catálogo y clientes

### Category y Product

Category y Product son tenant-scoped. Product conserva SKU, barcode opcional, slug, datos comerciales, precio CLP entero, mínimo, imagen por URL y flags de publicación/actividad/destacado.

Restricciones únicas relevantes:

- `organization_id + sku`;
- `organization_id + slug`;
- `organization_id + barcode` cuando no es nulo;
- categoría y producto siempre deben pertenecer al mismo tenant.

Customer mantiene contacto, dirección y estado comercial. Su email es único dentro de la organización y no modifica automáticamente las credenciales globales de User.

## Inventario

### InventoryLocation e InventoryLot

Las ubicaciones usan código único por organización. Los lotes pertenecen a un producto del mismo tenant, tienen número único por producto y fecha de vencimiento opcional.

### InventoryBalance

Materializa `physical_quantity` y `reserved_quantity` por producto, ubicación y lote opcional. Índices únicos parciales separan balances con lote y sin lote. El disponible se calcula como `physical - reserved`; no se persiste como una tercera verdad.

La base garantiza:

```text
physical >= 0
reserved >= 0
reserved <= physical
```

### InventoryMovement

Ledger inmutable de ocho tipos. Conserva delta, snapshots físicos/reservados antes y después, actor, ubicaciones, motivo, notas y fecha. Un check verifica que el snapshot nuevo coincida con el anterior más el delta.

### InventoryReservation

Reserva persistente de ecommerce con estados `ACTIVE`, `COMMITTED`, `CONSUMED`, `RELEASED` y `EXPIRED`, vencimiento y referencia a Order. Checkout incrementa `reserved_quantity`; pago aprobado compromete; cancelación/rechazo/expiración libera; fulfillment completado consume. La asignación usa FEFO por lote (`expiration_date ASC NULLS LAST`, luego antigüedad) y puede dividir una línea entre varios balances.

## Pedidos

### Order, OrderItem y OrderStatusEvent

Order pertenece a un Customer del mismo tenant y tiene número único por organización. Subtotal, descuento, despacho y total son enteros; un check verifica `total = subtotal - discount + shipping`.

OrderItem guarda snapshots de SKU, nombre y precio para que el historial no cambie al editar Product. OrderStatusEvent conserva transición, actor, motivo y fecha. Los estados se cambian mediante la máquina de estados del servidor.

### Payment, PaymentAttempt, PaymentProviderEvent y Refund

`Payment` pertenece a una Order y conserva provider, external reference, estado interno, importe CLP, moneda, IDs del proveedor y timestamps de aprobación/cancelación/reembolso/reconciliación. `PaymentAttempt` permite reintentos sobre la misma Order sin duplicar pedidos. `PaymentProviderEvent` persiste eventos sanitizados y deduplica por `provider + provider_event_id`. `Refund` modela el reembolso total actual, con actor staff, reason, provider refund ID y estado.

Estados internos de pago:

```text
CREATED, PENDING, APPROVED, REJECTED, CANCELLED, REFUNDED, ERROR
```

## Paquetes

### Package y TrackingEvent

Package pertenece a Customer, puede asociarse a Order y ubicación del mismo tenant, y tiene tracking único por organización. Mantiene hitos de recepción, almacenaje, disponibilidad y retiro, además de requisitos de frío y peso.

TrackingEvent registra cada transición con estado anterior/nuevo, descripción, ubicación, notas, actor y fecha.

### PackagePickupReceipt

Comprobante uno-a-uno creado durante entrega. Guarda quién recibió, quién entregó, fecha y confirmación de código verificado. Package solo persiste el hash del código de retiro y la fecha de consumo; nunca el texto plano.

## Configuración, auditoría y controles operativos

### OrganizationSettings

Agregado uno-a-uno con Organization para contacto, retiro y umbrales de stock, permanencia de paquetes y vencimientos.

### AuditLog

Registro append-only de acción, tipo/ID de entidad, actor, snapshots JSON permitidos, request ID y fecha. Sus foreign keys conservan tenant y nunca almacenan contraseñas, cookies, tokens CSRF/sesión ni código de retiro plano.

### IdempotencyRecord

Registra HMAC de clave y request, operación, estado, respuesta reproducible, recurso, ID del request original y expiración. Es único por organización, actor y hash de clave.

### RateLimitBucket

Contador persistente por scope y HMAC de clave, con ventana, bloqueo y expiración. La expiración está indexada para su poda oportunista.

### OutboxEvent

Registro tenant-scoped de notificaciones transaccionales con event key única, tipo, destinatario, payload validado, estado, contador de intentos, lease, próximo intento, último error e identificador del provider. Se inserta en la misma transacción que Order/Payment y se procesa en lotes con `FOR UPDATE SKIP LOCKED`. Los estados terminales permiten distinguir entrega de agotamiento de reintentos.

## Índices principales

Las consultas reales están cubiertas por índices que comienzan por `organization_id` y combinan, según el caso:

- customer/product/status y `created_at`;
- order number, payment y customer;
- tracking code, package status y ubicación;
- product/location/lot en balances y reservas;
- expiration date para lotes y reservas;
- entidad/request ID en auditoría;
- expiración de Session, IdempotencyRecord y RateLimitBucket.

No se indexa cada columna indiscriminadamente.

## Inventario de modelos

El contrato contiene modelos de aplicación tenant-scoped:

```text
Organization, User, Role, Permission, RolePermission, Membership, Customer,
Session, Category, Product, InventoryLocation, InventoryLot, InventoryBalance,
InventoryMovement, InventoryReservation, Order, OrderItem, OrderStatusEvent,
Payment, PaymentAttempt, PaymentProviderEvent, Refund, Package, TrackingEvent,
PackagePickupReceipt, OrganizationSettings, AuditLog, IdempotencyRecord,
RateLimitBucket, OutboxEvent.
```

También contiene enums para estado de identidad/membership/customer, audiencia, movimiento/reserva, pedido/pago/fulfillment, paquete e idempotencia.

## Historial de migraciones

Las migraciones son incrementales; no se reescribe una migración aplicada:

1. `20260901T1828_initial`: esquema autoritativo inicial, constraints e índices.
2. `20260901T2354_identity_names`: nombres de identidad requeridos por sesión/UI.
3. `20260902T0010_request_id_text`: request IDs compatibles con clientes externos.
4. `20260902T2221_inventory_reservation_snapshots`: invariantes de cantidades reservadas.
5. `20260902T2237_order_status_reason_length`: longitud contractual del motivo.
6. `20260904T0252_tracking_event_description_length`: longitud contractual de eventos.
7. `20260904T0255_settings_contract_lengths`: longitudes del agregado settings.
8. `20260907T0011_phase_4_payments`: pagos, intentos, eventos de provider, reembolsos, estado `COMMITTED` de reservas, vínculo reserva-movimiento y constraints/índices de Fase 4.
9. `20260911T0128_phase_5_outbox`: outbox transaccional, lease, reintentos e índices de entrega.

`pnpm db:migration:check`, `pnpm db:verify` y las suites contra PostgreSQL comprueban la cadena sin ejecutar resets destructivos.
