# TraceLink V2 · CH Market

Frontend completo de TraceLink V2 para CH Market, desarrollado por Colvin Solutions. La aplicación reúne una tienda pública, un portal privado de cliente y un portal operativo para personal sobre contratos tipados y adapters mock reemplazables por HTTP.

## Estado de la entrega

La Fase 2 de frontend incluye:

- storefront responsive con catálogo, producto, carrito y checkout visual;
- login y sesiones demo diferenciadas para cliente y personal;
- portal cliente con pedidos, paquetes, trazabilidad y perfil editable;
- administración de productos, inventario, pedidos, paquetes y clientes;
- usuarios, seis roles iniciales y permisos granulares;
- dashboard derivado de la operación mock, reportes CSV y configuración;
- stock público/administrativo proyectado desde inventario y alertas gobernadas por umbrales configurables;
- estados loading, error, empty, success, pending y disabled;
- confirmaciones accesibles para acciones de riesgo;
- 111 pruebas automatizadas en 36 archivos y un E2E responsive de los cuatro recorridos críticos.

No hay backend, pagos reales, reserva transaccional de stock, autenticación remota ni persistencia de sesión. Los datos demo viven en memoria y se restablecen al recargar la aplicación.

## Requisitos

- Node.js 22.12 o superior.
- pnpm 11.24.0. Los ejemplos usan Corepack, por lo que no es necesario instalar pnpm globalmente.
- Chrome o Microsoft Edge para el smoke E2E.

## Cómo iniciar el proyecto

Desde la carpeta `TraceLink`:

```powershell
corepack pnpm install
corepack pnpm dev
```

Abre `http://127.0.0.1:5173` o la dirección indicada por Vite.

En `/login` existen dos accesos sin credenciales:

- **Entrar como cliente** abre `/mi-cuenta` con registros privados mock.
- **Entrar como personal** abre `/app/dashboard` con todos los permisos demo.

## Comandos de calidad

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Para el E2E, deja el servidor de desarrollo ejecutándose en otra terminal y usa:

```powershell
corepack pnpm test:e2e
# alias del mismo flujo
corepack pnpm review:visual
```

El script usa `playwright-core` con el navegador instalado. Revisa 375, 768, 1024 y 1440 px, detecta overflow horizontal y errores de página, genera 29 capturas y recorre tienda, cliente, personal y el ciclo completo de un paquete.

## Rutas principales

### Tienda pública

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

`/registro` continúa como redirección explícita a login hasta que exista un contrato de alta real.

### Portal cliente

```text
/mi-cuenta
/mi-cuenta/pedidos
/mi-cuenta/pedidos/:id
/mi-cuenta/paquetes
/mi-cuenta/paquetes/:id
/mi-cuenta/perfil
```

### Portal de personal

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

## Arquitectura

```text
Pantalla → hook/use case de feature → interfaz de servicio → adapter mock
                                                     └── adapter HTTP futuro
```

- `apps/web/src/app`: router, providers y configuración global.
- `apps/web/src/components`: primitivas y composiciones compartidas.
- `apps/web/src/features`: dominio, schemas, queries, servicios y páginas por feature.
- `apps/web/src/layouts`: shells público, cliente y administrativo.
- `apps/web/src/lib`: formato CLP/fechas y utilidades transversales.
- `apps/web/src/styles`: tokens y estilos globales.

Los componentes no importan fixtures ni llaman `fetch`. TanStack Query representa estado de servidor; React conserva únicamente estado local como carrito y sesión demo.

## Contratos preparados para backend

La UI ya consume interfaces separadas para:

- `AuthService`;
- `ProductService`;
- `InventoryService`;
- `OrderService` y `StaffOrderService`;
- `PackageService` y `StaffPackageService`;
- `CustomerSelfService` y `StaffCustomerService`;
- `UserService`;
- `RoleService`;
- `DashboardService`;
- `ReportService`;
- `SettingsService`.

Un adapter HTTP futuro debe validar respuestas externas, conservar estas fronteras semánticas y volver a comprobar identidad, propiedad y permisos en servidor.

## Configuración regional y tenant

La marca base vive en `apps/web/src/app/config/brand.ts`:

- locale `es-CL`;
- moneda `CLP` con montos enteros;
- timezone `America/Santiago`;
- organización y área de servicio centralizadas.

La configuración operativa mock parte de esos valores; no introduce otro identificador de tenant disperso.

## Seguridad y límites

- No agregues `.env`, secretos ni tokens al repositorio.
- La autorización frontend es UX; el backend será la frontera autoritativa.
- Los datos privados usan contratos de “cliente actual”, nunca una búsqueda libre de propietario.
- Las queries privadas se separan por identidad y se limpian al restaurar, cambiar o cerrar sesión.
- El inventario solo cambia mediante movimientos auditables; ningún formulario edita stock directamente.
- El checkout declara de forma visible que no cobra ni reserva inventario.
- La exportación CSV neutraliza celdas que podrían interpretarse como fórmulas.

Los adapters mock son deliberadamente locales: sesión, carrito y mutaciones se reinician al recargar. Las vistas cliente/personal de pedidos y paquetes, los reportes y la sesión demo aún no comparten una fuente remota autoritativa; esos límites corresponden a la integración backend de la siguiente fase.

## Documentación

- [`ARCHITECTURE.md`](ARCHITECTURE.md): arquitectura y límites del producto.
- [`docs/frontend-design.md`](docs/frontend-design.md): sistema visual, layouts y patrones UX.
- [`docs/frontend-roadmap.md`](docs/frontend-roadmap.md): `FRONTEND DONE / BACKEND NEXT / LATER`.
- [`docs/legacy-audit.md`](docs/legacy-audit.md): auditoría de proyectos históricos y decisiones de reutilización.
- [`FinFase 2.txt`](FinFase%202.txt): informe completo del trabajo y las verificaciones de la Fase 2.
