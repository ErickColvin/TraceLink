# TraceLink V2 · CH Market

Base frontend de TraceLink V2 para CH Market, desarrollada por Colvin Solutions. Esta entrega reúne una tienda pública, un portal privado de cliente y un shell operativo para personal, todos sobre servicios mock tipados y reemplazables por adaptadores HTTP.

## Estado de la entrega

Incluye:

- home comercial responsive;
- catálogo con búsqueda, categorías, disponibilidad y ordenamiento;
- detalle de producto y carrito local demostrativo;
- login preparado para autenticación futura y accesos demo explícitos;
- portal cliente con resumen, pedidos, paquetes, perfil y detalle;
- timeline reutilizable de trazabilidad;
- shell administrativo con navegación por permisos y dashboard inicial;
- contratos de productos, pedidos, paquetes, clientes, inventario y dashboard;
- estados de carga, error, vacío, éxito y controles deshabilitados;
- pruebas unitarias y de integración frontend.

No incluye backend, pagos, persistencia de sesión, stock transaccional ni autenticación real. Los accesos demo viven solo en memoria y no emiten tokens.

## Requisitos

- Node.js 22.12 o superior.
- pnpm 11.24.0. Si `pnpm` no está instalado globalmente, usa `corepack pnpm` en los comandos iniciales.

## Inicio rápido

```powershell
corepack pnpm install
corepack pnpm dev
```

La aplicación queda disponible en `http://127.0.0.1:5173` o en la URL indicada por Vite.

En `/login` están disponibles dos accesos sin credenciales:

- **Entrar como cliente** abre `/mi-cuenta` con datos privados mock de Valentina Rojas.
- **Entrar como personal** abre `/app/dashboard` con permisos administrativos mock.

## Comandos

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Para repetir la revisión visual, deja `corepack pnpm dev` ejecutándose en otra terminal y usa:

```powershell
corepack pnpm test:e2e
# alias descriptivo del mismo flujo:
corepack pnpm review:visual
```

El script utiliza `playwright-core` con Chrome o Edge instalado. Captura Home a 375, 768, 1024 y 1440 px, y toma muestras adicionales de catálogo, detalle, login, portal cliente y dashboard en los anchos relevantes; falla si detecta overflow horizontal del documento. También comprueba la búsqueda de paquetes por contenido y el aislamiento de foco, fondo y scroll del drawer administrativo. Las capturas se escriben en el directorio temporal del sistema.

## Estructura

```text
TraceLink/
├── apps/
│   └── web/
│       ├── public/
│       └── src/
│           ├── app/          # providers, rutas y configuración de marca
│           ├── components/   # UI compartida
│           ├── features/     # dominio, servicios, queries y pantallas
│           ├── layouts/      # público, cliente y administración
│           ├── lib/          # formato CLP/fechas y utilidades
│           └── styles/       # tokens y estilos globales
├── docs/
├── tools/
├── AGENTS.md
└── ARCHITECTURE.md
```

El acceso a datos sigue esta dirección:

```text
Pantalla → hook de feature → interfaz de servicio → adapter mock
```

Los fixtures se mantienen privados dentro de cada feature. Una integración futura sustituirá los adapters mock por adapters HTTP sin cambiar las páginas.

## Configuración regional

La marca y la configuración regional viven en `apps/web/src/app/config/brand.ts`:

- locale: `es-CL`;
- moneda: `CLP`;
- timezone: `America/Santiago`.

Los montos y fechas se formatean mediante `Intl` desde utilidades centralizadas. Los valores monetarios CLP son enteros.

## Documentación

- [`ARCHITECTURE.md`](ARCHITECTURE.md): arquitectura objetivo y límites.
- [`docs/legacy-audit.md`](docs/legacy-audit.md): auditoría de los tres proyectos históricos y matriz de reutilización.
- [`docs/frontend-design.md`](docs/frontend-design.md): sistema visual, layouts y patrones UX.
- [`docs/frontend-roadmap.md`](docs/frontend-roadmap.md): estado `DONE / NEXT / LATER`.

## Seguridad

- No agregues `.env`, secretos ni tokens al repositorio.
- La autorización frontend solo mejora la UX; el backend futuro deberá validar sesión, permisos y propiedad de registros.
- Los datos de cliente se obtienen mediante contratos `current customer`; nunca mediante búsqueda libre por nombre.
- La caché privada se separa por identidad autenticada y se limpia al restaurar, cambiar o cerrar sesión.
- Los repositorios legacy contienen antecedentes de credenciales versionadas. No se copió ningún secreto a esta solución.
