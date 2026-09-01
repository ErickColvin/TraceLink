# TraceLink V2 — mapa de contratos frontend/API

Estado: contrato base de Fase 3, creado antes de implementar controladores.

Este documento traduce los 47 métodos de los 14 servicios existentes del frontend a la API HTTP v1. La API conserva los DTO visibles para las pantallas cuando es seguro hacerlo y deja las diferencias de nombres de persistencia dentro de los adaptadores. Los modelos de Prisma no forman parte del contrato público.

## Convenciones comunes

- Prefijo estable: `/api/v1`.
- JSON en request y response, salvo respuestas `204 No Content`.
- La organización pública se resuelve con una clave de tenant configurada por el despliegue; nunca desde un `organizationId` enviado por el navegador.
- Las rutas `/me` derivan `userId`, `customerId` y `organizationId` de la sesión.
- Las rutas `/staff` derivan `userId`, `membershipId`, rol, permisos y `organizationId` de la sesión activa.
- Una entidad ajena al tenant o al customer autenticado responde `404 NOT_FOUND`. No se revela si existe en otro scope.
- Toda mutación autenticada por cookie exige un origen permitido y `X-CSRF-Token` válido.
- Los actores y tenants se derivan en el servidor. Un campo `actor`, `userId`, `customerId` de ownership u `organizationId` no es aceptado como autoridad.
- `Idempotency-Key` es obligatorio para movimientos de inventario, recepción y cambios de estado de paquetes, entrega de paquetes, cambios de estado y cancelación de pedidos.
- Los filtros array se serializan como parámetros repetidos: `statuses=PAID&statuses=READY`.
- Fechas de filtro usan `YYYY-MM-DD` en la zona horaria de la organización. Timestamps usan ISO 8601 UTC.
- Paginación: `{ items, page, pageSize, totalItems, totalPages }`; `page >= 1` y `1 <= pageSize <= 100`.
- Cada respuesta incluye `X-Request-Id`. Los errores incluyen el mismo identificador en el cuerpo.

### Error común

```ts
type ApiErrorResponse = {
  error: {
    code:
      | "VALIDATION_ERROR"
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "RATE_LIMITED"
      | "INVALID_STATE_TRANSITION"
      | "INSUFFICIENT_STOCK"
      | "IDEMPOTENCY_CONFLICT"
    message: string
    fieldErrors?: Record<string, string[]>
  }
  requestId: string
}
```

## AuthService — 4 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `getSession()` | `GET /api/v1/auth/me` | Sin body | `AuthMeResponse` | Cookie opcional | Ninguno | Únicamente la sesión presentada; `401` se proyecta como sesión anónima en el adapter. |
| `signIn(credentials)` | `POST /api/v1/auth/login` | `SignInRequest` | `AuthMeResponse` | Anónimo, Origin exacto y rate limit | Ninguno | Tenant resuelto por despliegue; `audience` expresa el portal esperado, no concede rol. |
| `startDemoSession(audience)` | Sin endpoint HTTP | Solo implementación mock | `AuthenticatedSession` mock | No aplica | No aplica | Se deshabilita en modo `http`; no existe bypass demo en producción. |
| `signOut()` | `POST /api/v1/auth/logout` | Sin body | `204` | Sesión actual + CSRF | Ninguno | Revoca la sesión actual de forma idempotente. |

```ts
type SignInRequest = {
  audience: "customer" | "staff"
  email: string
  password: string
}

type AuthMeResponse = {
  user: { id: string; email: string; firstName: string; lastName: string }
  audience: "customer" | "staff"
  organization: { id: string; slug: string; name: string }
  customer?: { id: string }
  membership?: { id: string; status: "ACTIVE" | "DISABLED" }
  role?: { id: string; code: string; name: string }
  permissions: string[]
  authenticatedAt: string
}
```

`POST /api/v1/auth/register` completa el registro customer requerido aunque aún no tenga método en `AuthService`. Usa `RegisterRequest`, devuelve `AuthMeResponse`, exige Origin exacto y rate limit, y nunca permite elegir rol ni tenant. Login, registro y `/auth/me` entregan el token CSRF asociado a la sesión dentro del envelope HTTP; el adapter lo retiene solo en memoria y proyecta `AuthMeResponse` al contrato de UI.

## ProductService — 10 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list(params?)` | `GET /api/v1/products` | Query `ProductListParams` | `ProductPage` | Público | Ninguno | Tenant público; solo productos activos y publicados. |
| `listAdmin(params?)` | `GET /api/v1/staff/products` | Query `ProductAdminListParams` | `ProductPage` | Staff | `products.view` | Tenant de la membership. |
| `listCategories()` | `GET /api/v1/products/categories` | Sin entrada | `ProductCategory[]` | Público | Ninguno | Categorías visibles del tenant público. |
| `getById(id)` | `GET /api/v1/staff/products/:id` | Path `{ id }` | `Product` | Staff | `products.view` | Búsqueda tenant-scoped. |
| `getBySlug(slug)` | `GET /api/v1/products/:slug` | Path `{ slug }` | `Product` | Público | Ninguno | Tenant público; producto activo y publicado. |
| `listRelated(slug, limit?)` | `GET /api/v1/products/:slug/related` | Path `{ slug }`, query `{ limit? }` | `Product[]` | Público | Ninguno | Mismo tenant; activos y publicados. |
| `create(input)` | `POST /api/v1/staff/products` | Body `ProductCommercialInput` | `Product` | Staff + CSRF | `products.create` | Tenant impuesto por sesión; category del mismo tenant. |
| `update(id, input)` | `PATCH /api/v1/staff/products/:id` | Path `{ id }`, body `ProductCommercialInput` | `Product` | Staff + CSRF | `products.update` | Producto y category tenant-scoped. |
| `setActive(id, active)` | `PATCH /api/v1/staff/products/:id/active` | Body `{ active: boolean }` | `Product` | Staff + CSRF | `products.update` | Producto tenant-scoped. |
| `setPublished(id, published)` | `PATCH /api/v1/staff/products/:id/publication` | Body `{ published: boolean }` | `Product` | Staff + CSRF | `products.update` | Producto tenant-scoped. |

`ProductListParams` contiene `search?`, `categoryId?`, `availability?`, `sort?`, `featured?`, `page?`, `pageSize?`. `ProductAdminListParams` contiene `search?`, `categoryId?`, `active?`, `publication?`, `sort?`, `page?`, `pageSize?`.

`ProductCommercialInput` contiene `sku`, `barcode?`, `slug`, `name`, `description?`, `brand?`, `categoryId`, `salePrice` entero CLP, `minimumStock?`, `imageUrl?`, `published` y `active`. `Product` agrega campos de identidad, `availableStock` derivado y `featured`.

## InventoryService — 5 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list(params?)` | `GET /api/v1/staff/inventory` | Query `InventoryListParams` | `InventoryPage` | Staff | `inventory.view` | Lotes y balances del tenant. |
| `listCategories()` | `GET /api/v1/staff/inventory/categories` | Sin entrada | `InventoryCategory[]` | Staff | `inventory.view` | Categorías del tenant. |
| `getById(id)` | `GET /api/v1/staff/inventory/:id` | Path `{ id }` | `InventoryItem` | Staff | `inventory.view` | Inventory item tenant-scoped. |
| `listMovements(params?)` | `GET /api/v1/staff/inventory/movements` | Query `InventoryMovementListParams` | `InventoryMovementPage` | Staff | `inventory.view` | Movimientos del tenant. |
| `createMovement(input)` | `POST /api/v1/staff/inventory/movements` | Body `CreateInventoryMovementRequest`, header `Idempotency-Key` | `InventoryMovement` | Staff + CSRF | `inventory.adjust` | Item, producto, lote y ubicaciones del tenant; actor de sesión. |

```ts
type CreateInventoryMovementRequest = {
  inventoryItemId: string
  type: InventoryMovementType
  quantity: number
  adjustmentDirection: "INCREASE" | "DECREASE"
  originLocation?: string
  destinationLocation?: string
  reason?: string
  notes?: string
}
```

El servidor valida combinaciones `type`/dirección/localización, bloquea el balance relevante, calcula el delta y los snapshots, impide stock negativo y persiste movimiento, balance, idempotencia y auditoría dentro de una transacción. El preview del navegador nunca es autoritativo.

## OrderService — 2 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `listCurrentCustomer(params?)` | `GET /api/v1/me/orders` | Query `OrderListParams` | `OrderPage` | Customer | Ninguno adicional | `customerId` y tenant derivados de sesión. |
| `getCurrentCustomerById(id)` | `GET /api/v1/me/orders/:id` | Path `{ id }` | `Order` | Customer | Ninguno adicional | Query única por `id + organizationId + customerId`; fuera de scope devuelve `404`. |

`OrderListParams` contiene `statuses?`, `sort?`, `page?`, `pageSize?`. `Order` conserva items snapshot, montos CLP enteros, fulfillment, estado de pago, fechas, notas y `packageIds`.

## StaffOrderService — 4 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list(params?)` | `GET /api/v1/staff/orders` | Query `StaffOrderListParams` | `StaffOrderPage` | Staff | `orders.view` | Pedidos del tenant. |
| `getById(id)` | `GET /api/v1/staff/orders/:id` | Path `{ id }` | `StaffOrder` | Staff | `orders.view` | Pedido tenant-scoped. |
| `transitionStatus(input)` | `POST /api/v1/staff/orders/:id/transitions` | Path `input.orderId`; body `{ toStatus }`; `Idempotency-Key` | `StaffOrder` | Staff + CSRF | `orders.update` | Pedido del tenant; actor derivado de sesión. |
| `cancel(input)` | `POST /api/v1/staff/orders/:id/cancellation` | Path `input.orderId`; body `{ reason }`; `Idempotency-Key` | `StaffOrder` | Staff + CSRF | `orders.cancel` | Pedido del tenant; actor derivado de sesión. |

`StaffOrderListParams` contiene `query?`, `statuses?`, `paymentStatuses?`, `fulfillmentMethods?`, `dateFrom?`, `dateTo?`, `sort?`, `page?`, `pageSize?`. `StaffOrder` agrega customer, eventos de estado y motivo de cancelación.

El wire DTO nunca incluye `actor`. `CANCELLED` solo se alcanza por el endpoint de cancelación; el endpoint genérico aplica una state machine explícita y rechaza estados terminales o saltos inválidos con `INVALID_STATE_TRANSITION`.

## PackageService — 2 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `listCurrentCustomer(params?)` | `GET /api/v1/me/packages` | Query `PackageListParams` | `PackagePage` | Customer | Ninguno adicional | Tenant/customer derivados de sesión. |
| `getCurrentCustomerById(id)` | `GET /api/v1/me/packages/:id` | Path `{ id }` | `CustomerPackage` | Customer | Ninguno adicional | Query única por package, tenant y customer; fuera de scope devuelve `404`. |

`PackageListParams` contiene `search?`, `statuses?`, `sort?`, `page?`, `pageSize?`.

## StaffPackageService — 5 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list(params?)` | `GET /api/v1/staff/packages` | Query `StaffPackageListParams` | `StaffPackagePage` | Staff | `packages.view` | Paquetes del tenant. |
| `getById(id)` | `GET /api/v1/staff/packages/:id` | Path `{ id }` | `StaffPackage` | Staff | `packages.view` | Paquete tenant-scoped. |
| `receive(input)` | `POST /api/v1/staff/packages` | Body `ReceivePackageRequest`; `Idempotency-Key` | `StaffPackage` | Staff + CSRF | `packages.receive` | Customer, order y ubicación del tenant; order pertenece al customer; actor de sesión. |
| `transitionStatus(input)` | `POST /api/v1/staff/packages/:id/transitions` | Body `{ toStatus, description?, location? }`; `Idempotency-Key` | `StaffPackage` | Staff + CSRF | `packages.update` | Paquete del tenant; actor de sesión. |
| `deliver(input)` | `POST /api/v1/staff/packages/:id/delivery` | Body `{ pickupCode, receivedBy }`; `Idempotency-Key` | `StaffPackage` | Staff + CSRF | Paquete del tenant; código comparado con hash; actor de sesión. |

`StaffPackageListParams` contiene `search?`, `tracking?`, `customer?`, `carrier?`, `location?`, `statuses?`, `coldStorage?`, `sort?`, `page?`, `pageSize?`.

`ReceivePackageRequest` conserva los campos del input actual —tracking, carrier, `customerId`, `orderId?`, contenido, ubicación, notas, fechas y peso— excepto `actor`. `contents` contiene `description`, `itemCount` y `requiresColdStorage`.

`PICKED_UP` está prohibido en la transición genérica y solo puede alcanzarse por `delivery`. El código de retiro se genera de forma autoritativa, persiste únicamente como hash con expiración y consumo, no aparece en logs ni respuestas, y el fixture E2E usa un código conocido cuyo plaintext tampoco queda en la base.

La pantalla de recepción necesita opciones mínimas de customer, pero `packages.receive` no autoriza a leer el directorio completo. Se agrega `GET /api/v1/staff/package-customer-options?search=...`, respuesta paginada `{ id, displayName, email }[]`, autorizada por `packages.receive` y tenant-scoped. No reemplaza `/staff/customers`.

## CustomerSelfService — 2 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `getCurrent()` | `GET /api/v1/me/profile` | Sin entrada | `Customer` | Customer | Ninguno adicional | Customer derivado de la sesión. |
| `updateCurrent(input)` | `PATCH /api/v1/me/profile` | Body `CustomerProfileInput` | `Customer` | Customer + CSRF | Ninguno adicional | No acepta id; actualiza solo el customer de sesión. |

`CustomerProfileInput` contiene nombre, apellido, email de contacto, teléfono y dirección opcional. En Fase 3 el email de customer es contacto comercial y no cambia `User.email` ni las credenciales de acceso.

## StaffCustomerService — 3 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list(params?)` | `GET /api/v1/staff/customers` | Query `StaffCustomerListParams` | `StaffCustomerPage` | Staff | `customers.view` | Customers del tenant. |
| `getById(id)` | `GET /api/v1/staff/customers/:id` | Path `{ id }` | `StaffCustomerDetail` | Staff | `customers.view` | Customer, pedidos, paquetes y actividad del mismo tenant. |
| `update(id, input)` | `PATCH /api/v1/staff/customers/:id` | Path `{ id }`, body `StaffCustomerUpdateInput` | `StaffCustomerDetail` | Staff + CSRF | `customers.update` | Customer tenant-scoped; unicidad de email dentro del tenant. |

`StaffCustomerListParams` contiene `search?`, `status?`, `sort?`, `page?`, `pageSize?`. `StaffCustomerUpdateInput` extiende el perfil con `status`.

## UserService — 3 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list(params?)` | `GET /api/v1/staff/users` | Query `StaffUserListParams` | `StaffUserPage` | Staff | `users.view` | Memberships del tenant unidas a User y Role. |
| `getById(id)` | `GET /api/v1/staff/users/:id` | Path `{ id }` de membership | `StaffUser` | Staff | `users.view` | Membership tenant-scoped. |
| `update(input)` | `PATCH /api/v1/staff/users/:id/access` | Path `input.id` de membership; body `{ status, roleId }` | `StaffUser` | Staff + CSRF | `users.manage` | Membership y Role del tenant; auditoría y revocación si se deshabilita. |

`StaffUserListParams` contiene `search?`, `status?`, `roleId?`, `page?`, `pageSize?`. `StaffUser.id` representa la membership, no el User global. Deshabilitar una membership revoca sus sesiones en esa organización sin deshabilitar automáticamente al User en otros tenants.

## RoleService — 3 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list()` | `GET /api/v1/staff/roles` | Sin entrada | `StaffRoleDefinition[]` | Staff | `users.view` | Roles del tenant. |
| `getById(id)` | `GET /api/v1/staff/roles/:id` | Path `{ id }` | `StaffRoleDefinition` | Staff | `users.view` | Role tenant-scoped. |
| `updatePermissions(input)` | `PUT /api/v1/staff/roles/:id/permissions` | Path `input.id`; body `{ permissions }` | `StaffRoleDefinition` | Staff + CSRF | `users.manage` | Role tenant-scoped; invariantes de SUPER_ADMIN; auditoría. |

La API usa los seis códigos de rol del dominio, no el union reducido de tres etiquetas del auth mock. Las permissions se validan contra el catálogo conocido y no se aceptan strings arbitrarios.

## DashboardService — 1 método

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `getOverview()` | `GET /api/v1/staff/dashboard` | Sin entrada | `DashboardOverview` | Staff activo | Ninguno adicional | Agregados calculados exclusivamente dentro del tenant. |

No se inventa `dashboard.view`: no existe en las 20 permissions actuales. El backend devuelve tipos e identificadores de alerta; el adapter construye el `href` de React Router para evitar acoplar la API al router. Un permiso dedicado puede evaluarse en una fase posterior como cambio de producto.

## ReportService — 1 método

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- |
| `list(params?)` | `GET /api/v1/staff/reports` | Query `ReportListParams` | `OperationalReport` | Staff | `reports.view` | Datos y agregados del tenant. |

`ReportListParams` actual contiene `from?`, `to?`, `category?`, `status?`. El endpoint aplica un rango máximo documentado y una ventana interna paginada; el ajuste futuro de `page/pageSize` al contrato frontend se realizará separado si la UI necesita navegar más de una ventana. No se descargan miles de filas sin límite.

## SettingsService — 2 métodos

| Service method | HTTP y endpoint | Request DTO | Response DTO | Auth | Permiso | Ownership |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `get()` | `GET /api/v1/staff/settings` | Sin entrada | `OrganizationSettings` | Staff | `settings.manage` | Organization y settings de la sesión. |
| `update(input)` | `PUT /api/v1/staff/settings` | Body `OrganizationSettingsInput` | `OrganizationSettings` | Staff + CSRF | `settings.manage` | Tenant de sesión; Organization + settings en una transacción con auditoría. |

Aunque se persista en dos tablas, el endpoint trata los datos de organización, localización, contacto, retiro y thresholds como un solo agregado HTTP.

## Ajustes contractuales autorizados

Los siguientes cambios son necesarios para que el backend sea la autoridad y se implementan como cambios explícitos, no como divergencias silenciosas:

1. Los campos `actor` de pedidos y paquetes no se envían por HTTP. El adapter conserva la firma existente solo mientras las pantallas dependan de ella; el servidor deriva el actor.
2. Se añade un mecanismo de `RequestOptions { idempotencyKey }` para que una operación crítica pueda reintentarse con la misma clave. El adapter no crea una clave nueva al reintentar un resultado desconocido.
3. `PICKED_UP` y `CANCELLED` se excluyen de los endpoints genéricos y se alcanzan solo mediante sus acciones dedicadas.
4. Se añade registro customer y selección mínima de customers para recepción como endpoints API auxiliares. El bootstrap/rotación CSRF viaja en login y `/auth/me`.
5. `StaffUser.id` se define como membership ID; User y Membership dejan de estar conceptualmente mezclados.
6. Auth amplía los códigos de rol y errores para reflejar los seis roles, cuenta/membership deshabilitada, rate limit, CSRF y sesión revocada/expirada.
7. Se corrige el control visual de creación de movimientos para exigir `inventory.adjust`. El backend siempre lo exige aunque el frontend falle.
8. El email editable de `Customer` es contacto comercial; no modifica el email global de `User`.

## Decisiones de compatibilidad

- `products.delete` permanece reservado; activar/desactivar usa `products.update`, igual que la UI existente.
- `featured` se conserva en el DTO y persistencia de Product para no perder el filtro del storefront.
- `organizationId + sku`, `organizationId + slug` y `organizationId + barcode` no nulo son únicos.
- `minimumStock` de producto es el override; si es nulo se usa el threshold global de settings.
- Los nombres de API priorizan el contrato frontend. Las equivalencias `fulfillmentType/fulfillmentMethod`, `discount/discountTotal`, `shipping/deliveryFee`, cantidades físicas/reservadas y snapshots se resuelven en mappers.
- Eventos de package tienen una representación canónica en API; aliases duplicados requeridos por la UI se forman en el adapter.
- Mutaciones administrativas sin versión mantienen last-write-wins en Fase 3 y registran auditoría; optimistic concurrency queda como deuda explícita, no como garantía implícita.

## Matriz de seguridad contractual

| Caso | Resultado estable |
| --- | --- |
| Sin cookie válida en ruta protegida | `401 UNAUTHENTICATED` |
| Customer intenta ruta `/staff` | `403 FORBIDDEN` |
| Staff sin permission | `403 FORBIDDEN` |
| ID de otro tenant o customer | `404 NOT_FOUND` |
| CSRF ausente/incorrecto u Origin no permitido | `403 FORBIDDEN` |
| `actor`/`organizationId` adicional en schema estricto | `400 VALIDATION_ERROR` |
| Transición fuera de state machine | `409 INVALID_STATE_TRANSITION` |
| Stock resultante negativo | `409 INSUFFICIENT_STOCK` |
| Misma idempotency key y mismo payload | Replay de status/body originales |
| Misma idempotency key y payload distinto | `409 IDEMPOTENCY_CONFLICT` |

Este mapa es la fuente de verdad para schemas compartidos, controllers, adaptadores HTTP y pruebas contractuales de Fase 3.
