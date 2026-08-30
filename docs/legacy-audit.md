# Auditoría legacy de TraceLink

Fecha de auditoría: 29 de agosto de 2026  
Alcance: inspección de solo lectura de los repositorios históricos y del workspace disponible.

## Resumen ejecutivo

La nueva versión no debe construirse sobre ninguno de los frontends existentes. Los tres proyectos aportan lenguaje de dominio, requisitos y patrones de interacción, pero sus límites técnicos no cumplen la arquitectura objetivo: no usan TypeScript estricto, no separan la UI de adaptadores de datos, carecen de una estrategia de pruebas frontend y contienen deuda de seguridad o reproducibilidad.

La decisión conservadora es crear TraceLink V2 desde cero conforme a `ARCHITECTURE.md`, reutilizando conceptos y el único activo visual original seleccionado, pero no módulos legacy completos.

Repositorios verificados:

- `Tesis1`: `https://github.com/ErickColvin/Tesis1`, rama `main`.
- `tracelink-frontend`: `https://github.com/ErickColvin/tracelink-frontend`, rama `main`.
- `Proyecto-1`: `https://github.com/ErickColvin/Proyecto-1`, rama `master`.

## Tesis1

### Qué contiene

- Frontend React 18, JavaScript/JSX, Vite, Tailwind 3, React Router 6 y Axios.
- Backend Express, MongoDB/Mongoose, JWT/bcrypt, ExcelJS, correo y Google Identity.
- Web pública de CH Market, autenticación, catálogo, administración de productos e inventario, importación Excel, alertas, pedidos/entregas, devoluciones y administración de usuarios.
- Modelos de `Package` y `Event`, repositorios y validaciones que anticipan trazabilidad.

El workspace abierto corresponde a este repositorio. Al inicio de la auditoría estaba en `main`, sincronizado con `origin/main` en `81cd463`, pero con una cantidad importante de cambios locales: 41 modificaciones no staged, dos eliminaciones staged y múltiples archivos sin seguimiento. La auditoría no modificó esos cambios.

### Arquitectura y funcionalidades

El frontend está organizado principalmente por páginas. `App.jsx` concentra rutas, restauración de sesión, autorización y composición de layouts. Las pantallas llaman a un cliente Axios global y conocen detalles de transporte. No existen contratos por feature, adaptadores intercambiables, TanStack Query ni validación de formularios mediante esquemas.

Son referencias funcionales útiles:

- catálogo con búsqueda, categorías, paginación, disponibilidad y CLP;
- flujo de cliente con pedidos vinculados al usuario autenticado;
- tabla de inventario, stock mínimo, alertas e importación;
- estados explícitos para productos, entregas y paquetes;
- barra de navegación filtrada por permisos;
- landing responsive con navegación móvil, skip link y respeto por `prefers-reduced-motion`;
- validación y normalización de importaciones en servicios del backend.

### Código o conceptos reutilizables

- Aislamiento conceptual de datos del cliente por identidad autenticada.
- Vocabulario de `Package` y `Event` como base conceptual de `TrackingEvent`.
- Estados finitos, disponibilidad, stock mínimo y formato monetario mediante `Intl.NumberFormat`.
- Patrones de filtros, badges de estado, paginación y confirmación, reimplementados con tipos y componentes nuevos.
- El activo visual original `ch-market-hero.jpg`, reutilizado sin alterar el repositorio de origen.

### Qué no reutilizar

- `App.jsx`, `DataProvider` y páginas monolíticas.
- Llamadas de red directas desde pantallas.
- JWT persistido en `localStorage` como modelo de seguridad.
- Permisos coarse-grained, modelos JSX sin tipos y diálogos construidos con `div`.
- CSS monolítico, glassmorphism y gradientes decorativos del panel operativo.
- El modelo `Delivery` que mezcla pedido, reserva, entrega y trazabilidad.

### Riesgos y deuda técnica

- Los archivos `.env` estuvieron versionados. Toda credencial histórica debe considerarse expuesta, rotarse y eliminarse del historial antes de un despliegue.
- No hay pruebas, lint ni typecheck del frontend.
- Componentes de cientos de líneas mezclan consulta, estado, reglas y presentación.
- Branding, contacto, locale y categorías están dispersos como valores hardcodeados.
- Hay desajustes entre filtros de frontend y backend, límites de paginación y campos editables.
- La accesibilidad de diálogos y manejo de foco es incompleta.
- Las fechas alternan entre locales y algunos montos concatenan `$` manualmente.

## tracelink-frontend

### Qué contiene

Prototipo administrativo standalone con React 18, Vite, Tailwind, Flowbite y JavaScript. Incluye login demo, dashboard, productos, paquetes, importación de texto CSV, alertas de stock, tema oscuro, filtros, ordenamiento, paginación, confirmaciones y toasts.

### Arquitectura y funcionalidades

`src/services/api.js` permite alternar conceptualmente entre HTTP y un modo demo en memoria. Es la idea más valiosa del repositorio, aunque el contrato, el transporte y el mock están fusionados y no tipados.

### Código o conceptos reutilizables

- Límite conceptual mock/HTTP.
- Flujo de lista y edición de productos.
- Estados finitos de paquetes y cambios de estado.
- KPI de stock bajo y flujo de alertas leídas.
- Patrones visuales de filtro, confirmación y feedback como referencia de interacción.

### Qué no reutilizar

- La implementación mutable del mock ni el cliente HTTP fusionado.
- Autorización basada solo en token local y render condicional.
- Configuración visual y componentes sin separación por feature.
- Código JavaScript sin esquemas, pruebas ni estados de error completos.

### Riesgos y deuda técnica

- Versiona 13.779 archivos dentro de `node_modules`, además de un `.env`.
- El build falla por mezclar configuración y directivas de Tailwind 3 y 4.
- `main.jsx` renderiza un componente `Flowbite` no definido.
- No tiene scripts efectivos de lint, typecheck o tests.
- Presenta errores de marcado y accesibilidad, y utiliza un mock global mutable.

## Proyecto-1

### Qué contiene

Prototipo full-stack anterior con React/Vite/Tailwind y Express/Mongoose. Incluye inventario, carga Excel, alertas de stock, usuarios, administración, solicitudes genéricas, reportes e historial de errores. El documento `Tracelink.docx` conserva el problema original, roles, restricciones y quince historias de usuario.

### Arquitectura y funcionalidades

La implementación se desvió hacia una plataforma genérica llamada “DataUp” y no completa la trazabilidad de paquetes y devoluciones descrita en la documentación. Su principal valor es histórico: criterios para validación por fila, filtros combinados, auditoría de estado con usuario/fecha, confirmaciones destructivas, historial y exportación.

### Código o conceptos reutilizables

- Historias de usuario y criterios de aceptación del documento funcional.
- Vocabulario de inventario, proveedores, ubicaciones, paquetes y eventos.
- Requisitos de auditoría de cambios y reporte de errores de importación.
- Ideas de índices y estructura de esquemas, sujetas a rediseño.

### Qué no reutilizar

- Componentes frontend, autenticación, servidor, seeds o carga Excel.
- Flujos que permiten seleccionar identidad o administrador en el cliente.
- Cualquier secreto, archivo de entorno o conexión a base de datos.

### Riesgos y deuda técnica

- Incluye un `.env` y una credencial MongoDB hardcodeada. Debe revocarse y purgarse del historial sin copiarla ni divulgarla.
- Contraseñas en texto plano y un endpoint que las expone.
- No hay autenticación/autorización real en la API; el `ProtectedRoute` no se usa.
- El seed elimina usuarios en cada arranque.
- La importación elimina productos y alertas antes de completar y carece de límites sólidos de archivo.
- El lockfile está desincronizado: `npm ci` falla.
- No hay pruebas, lint ni typecheck.

## Portafolio

No se encontró un proyecto de portafolio identificable en el workspace, las ventanas recientes de VS Code ni los directorios locales habituales de desarrollo. Por ello no es posible afirmar qué tipografía, spacing, componentes, animaciones o microinteracciones utiliza.

La nueva UI mantendrá el nivel de calidad solicitado —jerarquía clara, tokens consistentes, navegación responsive, foco visible y movimiento restringido— como requisito del producto, no como reutilización atribuida al portafolio. Si el portafolio queda disponible después, debe auditarse mediante una ruta o URL explícita.

## Reuse Matrix

| Elemento | Clasificación | Decisión para V2 |
| --- | --- | --- |
| Aislamiento de pedidos por cliente autenticado | REUSE | Mantener como propiedad del contrato, nunca por búsqueda de nombre. |
| Estados de paquetes y eventos | REFACTOR | Convertir en uniones discriminadas y timeline tipado. |
| Formato CLP con `Intl.NumberFormat` | REUSE | Centralizar en `lib/formatters`. |
| Hero original de CH Market | REUSE | Copiar como activo local; conservar composición y optimizar la entrega desde Vite. |
| Filtros, badges, tablas y confirmaciones | REFACTOR | Reimplementar como componentes accesibles y testeables. |
| Límite mock/HTTP de `tracelink-frontend` | REFACTOR | Separar interfaz, adapter mock e inyección. |
| Historias de usuario de `Proyecto-1` | REFERENCE ONLY | Usar para roadmap y criterios, no como arquitectura. |
| Backend Express/Mongoose e importación Excel | REFERENCE ONLY | Fuera del milestone frontend-first. |
| Google login y correo | REFERENCE ONLY | Integraciones futuras. |
| Páginas monolíticas y contextos globales legacy | DISCARD | Sustituir por organización orientada a features. |
| JWT en `localStorage` | DISCARD | El mock no persiste credenciales ni simula una frontera de seguridad. |
| Credenciales y `.env` históricos | DISCARD | No copiar; rotación y limpieza quedan como seguimiento urgente. |

## Verificación contra la arquitectura objetivo

No se encontró una contradicción entre `AGENTS.md` y `ARCHITECTURE.md`. Sí existe una brecha amplia entre esos documentos y los proyectos legacy. Para V2 prevalecen los documentos objetivo: React con TypeScript estricto, features modulares, contratos de servicio, adapters mock, configuración de tenant centralizada, rutas protegidas y estados async explícitos.

