# Diseño frontend de TraceLink V2 / CH Market

## Estado y alcance

Documento de implementación vigente al 31 de agosto de 2026. La Fase 2 deja navegables y funcionales con datos mock las tres superficies del producto:

1. storefront público de CH Market;
2. portal privado del cliente;
3. portal operativo de personal.

El frontend modela las operaciones reales, pero no sustituye autenticación, autorización, pagos, inventario transaccional ni persistencia de backend.

## Principios

- La tienda se siente comercial y cercana; no como un ERP.
- El portal cliente prioriza privacidad, confianza y lectura simple de estados.
- El portal operativo es más denso, sin perder jerarquía ni accesibilidad.
- Las páginas orquestan; las reglas viven en dominio, schemas, workflows y servicios de feature.
- Ninguna pantalla importa fixtures, llama `fetch` o decide qué adapter está activo.
- Cada mutación muestra pending, evita doble envío y entrega feedback de éxito/error.
- Las acciones de riesgo requieren confirmación explícita.
- El color nunca es la única señal de estado.

## Arquitectura de presentación y datos

```text
Router / layouts / providers
            |
            v
       Páginas de feature
            |
            v
 Componentes + query hooks
            |
            v
  Contratos de servicio
            |
      +-----+------+
      |            |
 adapter mock   adapter HTTP futuro
```

Responsabilidades:

- `src/app`: router, providers, marca y comportamiento global de navegación.
- `src/layouts`: shells público, cliente y administrativo.
- `src/components`: primitivas y composiciones independientes del dominio.
- `src/features/<feature>`: tipos, workflows, schemas, servicios, queries, componentes y páginas.
- `src/lib`: formato CLP/fechas y utilidades transversales.
- `src/styles`: tokens y estilos base.

TanStack Query administra datos con semántica de servidor. React mantiene estado local de vista, sesión demo y carrito. Los mocks mutables viven en memoria y entregan copias para que una pantalla no modifique el estado por referencia. Una raíz de composición compartida conecta inventario, catálogo, dashboard y configuración sin filtrar detalles mock hacia las pantallas.

## Fronteras de servicio

| Dominio | Contrato actual |
| --- | --- |
| Sesión | `AuthService` |
| Productos | `ProductService` |
| Inventario | `InventoryService` |
| Pedidos cliente/personal | `OrderService` / `StaffOrderService` |
| Paquetes cliente/personal | `PackageService` / `StaffPackageService` |
| Clientes | `CustomerSelfService` / `StaffCustomerService` |
| Usuarios | `UserService` |
| Roles | `RoleService` |
| Dashboard | `DashboardService` |
| Reportes | `ReportService` |
| Configuración | `SettingsService` |

Los métodos de cliente actual nunca aceptan un `customerId`. Los contratos de personal son explícitamente distintos. El adapter HTTP futuro resolverá la identidad en servidor y responderá como no encontrado ante registros fuera de alcance.

El dashboard recibe los servicios operacionales por dependencia y calcula KPIs/alertas sobre sus estados actuales. Las mutaciones de inventario, pedidos y paquetes invalidan `dashboard`, evitando métricas desconectadas. Los umbrales de stock, vencimiento y permanencia de paquetes proceden de `SettingsService`; el catálogo proyecta su disponibilidad desde los lotes de `InventoryService`.

## Marca y tokens

La fuente base del tenant vive en `src/app/config/brand.ts`:

| Campo | Valor inicial |
| --- | --- |
| Nombre | CH Market |
| Organización | Colvin Solutions |
| Locale | `es-CL` |
| Moneda | `CLP` |
| Zona horaria | `America/Santiago` |
| Área de servicio | Huechuraba, Santiago |

La configuración operativa mock se inicializa desde esa fuente; no crea otro identificador de organización disperso.

Tokens en `src/styles/index.css`:

- `brand`: identidad azul, enlaces, foco y acciones principales;
- `ice`: fondos y superficies frías;
- `coral`: atención, advertencia y peligro;
- `ink`: texto, bordes y neutrales;
- `shadow-soft`, `shadow-card`, `shadow-lifted`;
- familias `font-sans` y `font-display`.

Los montos CLP son enteros y se formatean mediante `Intl`. Las fechas visibles usan zona de Santiago; las fechas calendario usan un formateador UTC específico para evitar desplazamiento de día.

## Layouts y navegación

### Público

`PublicLayout` contiene skip link, franja de servicio, header sticky, navegación responsive, carrito, login, `Outlet` y footer. El menú móvil cierra al navegar o con Escape y devuelve el foco al activador.

Rutas:

```text
/
/productos
/productos/:slug
/nosotros
/contacto
/carrito
/checkout
/login
```

`/registro` redirige a login hasta que exista alta real. El checkout es visual y declara que no procesa pagos ni reserva stock.

### Cliente

`CustomerLayout` usa navegación horizontal en móvil/tablet y sidebar desde `lg`. La identidad procede de la sesión; los datos ampliados proceden del servicio self. Incluye skip link y cierre de sesión con error visible.

```text
/mi-cuenta
/mi-cuenta/pedidos
/mi-cuenta/pedidos/:id
/mi-cuenta/paquetes
/mi-cuenta/paquetes/:id
/mi-cuenta/perfil
```

El perfil es editable con RHF/Zod y una mutación sin identificador libre. Los cambios mock no usan `localStorage`.

### Personal

`AdminLayout` muestra sidebar a partir de 1024 px y drawer modal bajo ese ancho. La navegación se filtra por permisos y cada grupo de rutas repite el guard. Incluye skip link y conserva foco/scroll correctamente al cerrar el drawer.

```text
/app/dashboard
/app/products
/app/products/new
/app/products/:id
/app/products/:id/edit
/app/inventory
/app/inventory/movements
/app/orders
/app/orders/:id
/app/packages
/app/packages/new
/app/packages/:id
/app/customers
/app/customers/:id
/app/users
/app/users/:id
/app/roles
/app/reports
/app/settings
```

Las tablas operativas se muestran en desktop y se transforman en tarjetas legibles en móvil. Checkout y las rutas operacionales se cargan con `React.lazy`/`Suspense`, reduciendo el JavaScript inicial sin cambiar sus contratos ni guards.

## Workflows operacionales

### Productos

- Creación y edición de campos comerciales con RHF/Zod.
- Búsqueda, categoría, estado, publicación, orden y paginación.
- Activar/desactivar y publicar/despublicar con confirmación.
- El stock es solo lectura; inventario es su única fuente de cambios y se proyecta al catálogo en cada consulta.

### Inventario

Estados calculados: `OK`, `LOW`, `OUT`, `EXPIRING`, `EXPIRED`.

```text
availableStock = physicalStock - reservedStock
```

Los cambios se registran como `PURCHASE_RECEIPT`, `SALE`, `ADJUSTMENT`, `RETURN`, `DAMAGE`, `EXPIRED`, `TRANSFER_IN` o `TRANSFER_OUT`. Ajuste, daño y vencimiento exigen motivo. La UI muestra snapshot antes/después y el servicio bloquea stock físico negativo o inferior a lo reservado. Estados y vencimientos se recalculan con el reloj actual, y el historial admite búsqueda, tipo y rango de fechas.

### Pedidos

```text
PENDING_PAYMENT → PAID → PREPARING → READY → COMPLETED
```

No se permiten saltos. La cancelación solo se ofrece desde estados válidos, exige motivo y crea `OrderStatusEvent` con actor y fecha.

La cola admite búsqueda, estado, pago, fulfillment, rango de fechas, orden y paginación. El detalle muestra cliente/contacto, productos, costos, notas e historial completo.

### Paquetes

```text
EXPECTED → RECEIVED → STORED → READY_FOR_PICKUP → PICKED_UP
```

Excepciones: `INCIDENT`, `RETURNED`, `LOST`. Cada transición crea un `TrackingEvent`. La recepción selecciona un cliente del servicio autorizado; no existe campo libre de propietario. La entrega exige código de retiro y nombre del receptor, no conserva el código y crea comprobante/evento. La cola separa filtros de tracking, cliente, carrier, estado y ubicación, y calcula el tiempo almacenado desde los eventos.

### Usuarios y roles

Roles iniciales:

```text
SUPER_ADMIN
ADMIN
INVENTORY
OPERATIONS
SALES
WAREHOUSE
```

Las capacidades de la interfaz dependen de claves `Permission`, nunca de comparar el nombre del rol. La asignación de rol/estado y los cambios de permisos requieren confirmación. Superadministración conserva todos los permisos en el adapter demo.

### Checkout, reportes y configuración

- Checkout usa RHF/Zod, retiro o despacho futuro, resumen CLP, estado pending y comprobante simulado sin pago ni reserva.
- Reportes filtran ventas, pedidos, inventario y paquetes por fecha/categoría/estado y exportan CSV local protegido contra fórmulas.
- Settings administra organización, locale, moneda, zona horaria, contacto, retiro y umbrales operacionales sobre el contrato centralizado.

## Componentes compartidos

- `Button` / `buttonStyles`.
- `Card` y sus subcomponentes.
- `Badge` con etiqueta textual.
- `Alert`, `AlertTitle`, `AlertDescription`.
- `Input` y `Label`.
- `PageHeader`, `SectionHeading`, `BrandLogo`.
- `LoadingSkeleton`, `Spinner`, `ErrorState`, `EmptyState`.
- `ConfirmationDialog`: `alertdialog`, foco inicial, trampa de Tab, Escape, backdrop, bloqueo de scroll, retorno de foco y estado pending.
- `TrackingTimeline`: pasos estándar, futuros, repetidos y excepciones.

## Responsive

| Viewport | Comportamiento esperado |
| --- | --- |
| 375 px | Una columna; navegación pública móvil; cuenta horizontal; drawer admin; formularios y acciones apilados; tablas como tarjetas. |
| 768 px | Grillas intermedias y formularios de dos columnas cuando hay espacio; shells privados aún móviles. |
| 1024 px | Navegación pública desktop, sidebar cliente de 230 px y admin de 260 px; tablas operativas cuando su densidad lo permite. |
| 1440 px | Contenido público centrado en `max-w-7xl`; paneles operativos amplios sin estirar líneas de lectura. |

El E2E genera 29 capturas y comprueba overflow horizontal global, errores JavaScript, aislamiento del drawer y recorridos completos en los cuatro viewports. Solo permite overflow en contenedores intencionalmente marcados.

## Accesibilidad

- HTML semántico, headings ordenados y labels nativos.
- Skip links en los tres shells.
- Foco visible global y foco del `main` después de cambiar de ruta.
- Drawer y confirmación con aislamiento modal y retorno de foco.
- Estados comunicados con texto/icono además de color.
- Feedback con `role="status"`, `role="alert"` o `aria-live` según urgencia.
- Controles disabled nativos y prevención de doble submit.
- Soporte para teclado y `prefers-reduced-motion`.
- Texto alternativo significativo cuando la imagen aporta información.

## Estados UX

| Estado | Patrón |
| --- | --- |
| Loading | skeleton estable; spinner para acción corta |
| Empty | explicación y CTA recuperable |
| Error | lenguaje accionable y reintento cuando aplica |
| Success | alert live y contenido actualizado |
| Pending | acción deshabilitada, `aria-busy` y texto progresivo |
| Disabled | atributo nativo y explicación de permiso/capacidad |
| Not found / fuera de alcance | mensaje indistinguible en detalles privados |

## Límites conocidos de los adapters mock

- Sesión, carrito y todas las mutaciones viven en memoria y se reinician al recargar.
- Los servicios cliente y personal de pedidos/paquetes son instancias separadas; una transición staff no se replica todavía en la vista cliente.
- Cambiar rol o estado de un usuario no modifica los permisos de la sesión demo ya iniciada.
- Los registros de reportes son estáticos y no agregan en tiempo real las mutaciones mock.
- El checkout no reserva ni descuenta inventario; solo cierra el recorrido visual.
- Cambiar `minimumStock` de un producto no migra lotes existentes; crear un producto no crea automáticamente un lote.
- Los movimientos usan lotes existentes y heredan lote/vencimiento; el alta de lotes queda para la persistencia autoritativa.
- La autorización del frontend mejora UX, pero no constituye una frontera de seguridad.

## Migración a backend

Para sustituir un mock:

1. conservar o evolucionar explícitamente la interfaz;
2. crear un adapter HTTP que valide la respuesta externa;
3. cambiar la composición en `services.ts`, no la página;
4. conservar query keys y revisar invalidaciones;
5. mapear errores reales a los estados ya diseñados;
6. revalidar identidad, propiedad, permisos y transiciones en servidor.

Pagos, reservas transaccionales, autenticación real, couriers, BI complejo y multi-tenant remoto quedan fuera del frontend completado.
