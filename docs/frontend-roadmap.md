# Roadmap de TraceLink V2 / CH Market

Corte de estado: 31 de agosto de 2026.

Este documento separa la interfaz terminada de las capacidades que requieren una fuente autoritativa. `DONE` significa que la ruta es navegable, responsive y funcional contra adapters mock; no implica que exista backend.

## FRONTEND DONE

### Fundación y arquitectura

- Workspace pnpm con React, TypeScript estricto, Vite, Tailwind, React Router, TanStack Query, React Hook Form, Zod, Vitest, React Testing Library y smoke Playwright.
- Organización orientada a features, configuración CH Market centralizada y CLP entero.
- Contratos por feature con adapters mock intercambiables por HTTP.
- Guards de cliente/personal y navegación administrativa basada en permisos tipados.
- Loading, error, empty, normal, success, pending y disabled según el flujo.
- Diálogo accesible compartido con control de foco, Escape, scroll lock y confirmación explícita.
- Skip links en los tres shells y foco del contenido principal después de navegar.
- Patrones responsive revisables en 375, 768, 1024 y 1440 px.
- Carga diferida de checkout y módulos operacionales; el bundle inicial bajó de aproximadamente 754 kB a 302 kB sin alterar rutas.

### Storefront público

- Home, catálogo, detalle, información, contacto y 404.
- Carrito local con límites de cantidad y total CLP.
- Checkout visual validado para retiro o despacho, resumen y confirmación mock.
- Declaración visible de que no existe pago ni reserva de stock.

### Portal cliente

- Resumen privado, pedidos propios y detalles.
- Paquetes propios, búsqueda y timeline de trazabilidad reutilizable.
- Perfil editable mediante contrato `current customer`, sin selector de propietario ni almacenamiento local.
- Caché privada separada por identidad y limpieza al cambiar sesión.

### Portal operativo

- Dashboard con seis KPIs derivados de los servicios operacionales, tendencia y alertas enlazadas a filtros; los umbrales salen de Settings.
- Productos: búsqueda, filtros, orden, paginación, alta, edición, detalle, activación y publicación.
- Inventario: stock físico/reservado/disponible, mínimos, ubicaciones, lotes, vencimientos y estados; el stock disponible se proyecta al catálogo.
- Movimientos: ocho tipos tipados, motivo condicional, preview antes/después y auditoría; no existe edición directa de stock.
- Pedidos: cola, búsqueda y filtros de estado/pago/fulfillment/fecha, detalle, transiciones secuenciales, eventos y cancelación confirmada con motivo.
- Paquetes: filtros separados de tracking/cliente/carrier/estado/ubicación, recepción seleccionando un cliente del servicio, detalle, tiempo almacenado, transiciones estándar/excepciones, tracking y entrega con código/receptor.
- Clientes: búsqueda, detalle y edición staff separada de la edición del cliente autenticado.
- Usuarios y roles: estado de cuenta, asignación confirmada y seis roles iniciales con permisos granulares.
- Reportes operativos filtrables y exportación CSV local sin dependencia pesada.
- Configuración mock de organización, región, contacto, retiro y umbrales, inicializada desde la marca central.

### Rutas funcionales

| Superficie | Rutas |
| --- | --- |
| Pública | `/`, `/productos`, `/productos/:slug`, `/nosotros`, `/contacto`, `/carrito`, `/checkout`, `/login` |
| Cliente | `/mi-cuenta`, `/mi-cuenta/pedidos`, `/mi-cuenta/pedidos/:id`, `/mi-cuenta/paquetes`, `/mi-cuenta/paquetes/:id`, `/mi-cuenta/perfil` |
| Productos | `/app/products`, `/app/products/new`, `/app/products/:id`, `/app/products/:id/edit` |
| Inventario | `/app/inventory`, `/app/inventory/movements` |
| Pedidos | `/app/orders`, `/app/orders/:id` |
| Paquetes | `/app/packages`, `/app/packages/new`, `/app/packages/:id` |
| Clientes | `/app/customers`, `/app/customers/:id` |
| Administración | `/app/dashboard`, `/app/users`, `/app/users/:id`, `/app/roles`, `/app/reports`, `/app/settings` |

`/registro` redirige deliberadamente a `/login`: no se presenta un alta ficticia sin contrato de identidad.

### Calidad automatizada

- Reglas y formularios críticos cubiertos en productos, inventario, pedidos, paquetes, clientes, roles, checkout y tracking.
- Guards, permisos, privacidad de cliente y limpieza de queries cubiertos.
- 111 tests en 36 archivos (frente a 43 tests al inicio de la fase).
- E2E para storefront, cliente, personal y ciclo `Receive → Store → Ready → Pickup`, con 29 capturas y viewports objetivo.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm test:e2e`.

## BACKEND NEXT

La siguiente fase debe conectar la UI existente; no reconstruir páginas ni navegación.

1. Implementar sesión remota segura, recuperación/alta de cuenta y cierre autoritativo.
2. Crear adapters HTTP por contrato y validar respuestas externas con Zod.
3. Aplicar autorización, permisos y propiedad de registros en servidor.
4. Persistir productos, clientes, usuarios, roles, configuración y eventos de auditoría.
5. Implementar inventario transaccional, reservas, concurrencia e idempotencia de movimientos.
6. Persistir máquinas de estados de pedidos/paquetes y rechazar transiciones inválidas en backend.
7. Integrar carga/almacenamiento de imágenes de producto.
8. Reemplazar reportes mock por consultas operacionales paginadas/exportaciones asíncronas cuando corresponda.
9. Agregar contratos de notificación, contacto y observabilidad.
10. Incorporar pruebas de contrato y E2E contra un entorno backend controlado.

Límites que el backend debe resolver, sin rediseñar la UI:

- unificar las vistas cliente/personal de pedidos y paquetes sobre la misma fuente autoritativa;
- hacer que cambios de usuario/rol afecten sesiones reales y volver a comprobar cada permiso;
- derivar reportes desde la operación persistida en vez de registros mock estáticos;
- persistir sesión, carrito y mutaciones, hoy reiniciados al recargar;
- reconciliar checkout con reserva/inventario y provisionar lotes para productos nuevos;
- definir la propagación entre mínimo comercial, mínimo por lote y defaults organizacionales.

Interfaces listas para adapters HTTP:

```text
AuthService
ProductService
InventoryService
OrderService / StaffOrderService
PackageService / StaffPackageService
CustomerSelfService / StaffCustomerService
UserService
RoleService
DashboardService
ReportService
SettingsService
```

## LATER

- Procesamiento de pagos y conciliación.
- Reserva autoritativa de stock durante checkout.
- Persistencia segura del carrito, si producto la prioriza.
- Registro público de cuenta y recuperación de contraseña.
- Integraciones con couriers, correo, SMS o identidad externa.
- Segunda organización y configuración multi-tenant remota.
- BI avanzado, importaciones masivas y auditoría de errores por fila.
- Aplicaciones móviles nativas.
- Microservicios, Kubernetes, GraphQL o IA solo ante una necesidad demostrada.

## Definition of done para BACKEND NEXT

Una integración solo está terminada cuando:

1. conserva el contrato o documenta su evolución;
2. valida datos externos en el límite;
3. vuelve a comprobar sesión, propiedad y permisos en servidor;
4. representa red, concurrencia y errores reales sin perder estados UX;
5. mantiene las rutas y la estructura visual salvo cambio de producto explícito;
6. incluye pruebas de contrato, integración y regresión;
7. pasa lint, tipos, tests, build y E2E.
