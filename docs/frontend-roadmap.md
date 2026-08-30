# Roadmap frontend de TraceLink V2 / CH Market

## Cómo leer este roadmap

Corte de estado: 29 de agosto de 2026.

- **DONE**: existe una implementación funcional y navegable en el código actual. Puede seguir usando datos mock si esa es la frontera declarada.
- **NEXT**: trabajo inmediato del milestone frontend-first. Incluye módulos cuyo route, permiso o contrato existe, pero cuya pantalla sigue siendo un shell.
- **LATER**: depende de una fase posterior, de backend o de una decisión de producto que no pertenece a la entrega inmediata.

Un contrato o fixture por sí solo no convierte una feature en DONE. Las rutas administrativas que renderizan `AdminComingSoonPage` se consideran shell-only.

## DONE — implementación disponible

### Fundación F1

- Workspace pnpm con `apps/web`, React, TypeScript estricto, Vite, Tailwind, React Router, TanStack Query, React Hook Form, Zod, Vitest y React Testing Library.
- Organización orientada a features, alias `@`, router y providers separados.
- Tokens `brand`, `ice`, `coral`, `ink`, tipografías y sombras centralizados.
- Configuración de tenant para nombre, locale, CLP, zona horaria, organización y zona de servicio.
- Primitivas accesibles de botón, tarjeta, badge, alert, input y label.
- Estados compartidos de carga, error y vacío.
- Formateadores centralizados de CLP, fecha y hora en `es-CL` / `America/Santiago`.
- Script de revisión visual para 375, 768, 1024 y 1440 px y detección de overflow horizontal.

### Límite de datos mock

- Contratos tipados y adapters mock separados para productos, pedidos de cliente, paquetes de cliente, clientes, inventario y dashboard.
- Hooks de TanStack Query con query keys por feature e identidad para los datos privados.
- Limpieza de queries privadas al restaurar, cambiar o cerrar sesión, sin eliminar la caché pública.
- Pedidos y paquetes privados filtrados dentro del adapter por el cliente de la sesión mock; la UI no recibe un selector de propietario.
- Datos clonados al salir de los adapters para evitar que una pantalla mute fixtures compartidos.
- Composición preparada para sustituir cada adapter sin importar fixtures desde las pantallas.
- Contratos y datos de inventario ya preparados, aunque su UI administrativa todavía no está implementada.

### F2 — tienda pública

- `/`: home comercial con hero original, categorías, destacados, beneficios y accesos a catálogo/cuenta.
- `/productos`: búsqueda por nombre, marca o SKU; filtro de categoría y disponibilidad; orden; estados loading/error/empty.
- `/productos/:slug`: detalle, disponibilidad, selector de cantidad, feedback de alta al carrito y productos relacionados.
- `/nosotros`: contenido institucional y propuesta de valor.
- `/contacto`: formulario con React Hook Form y Zod; simula éxito y declara que no envía datos.
- `/carrito`: carrito en memoria, límite por stock, ajuste/eliminación de cantidades, total CLP, empty state y checkout deshabilitado.
- Header/footer responsive, navegación móvil, acceso a seguimiento, contador de carrito, skip link y página 404.

### Autenticación y navegación protegida

- Modelo discriminado para visitante, cliente y personal, con permisos tipados.
- `CustomerRoute` y `StaffRoute` con estado de restauración, redirección por audiencia y feedback de permiso denegado.
- Saneamiento de `returnTo` para aceptar solo rutas internas y evitar redirecciones entre portales incompatibles.
- Login validado con React Hook Form/Zod y accesos demo diferenciados.
- Adapter de autenticación demo honesto: no acepta credenciales como reales, no emite token y no persiste sesión.
- Navegación administrativa filtrada por permisos y guards de permiso en cada módulo.

### F3 — portal cliente

- Shell responsive con header, identidad, navegación horizontal en móvil y sidebar en desktop.
- `/mi-cuenta`: resumen con KPIs y accesos a pedidos y paquetes recientes.
- `/mi-cuenta/pedidos`: listado de pedidos propios con estado, fecha, método y total.
- `/mi-cuenta/pedidos/:id`: detalle privado, líneas, totales y punto de retiro.
- `/mi-cuenta/paquetes`: listado privado, filtro por código o contenido y último evento.
- `/mi-cuenta/paquetes/:id`: detalle privado y timeline tipado con pasos futuros y excepciones.
- `/mi-cuenta/perfil`: identidad autenticada en modo de solo lectura.
- Estados explícitos de pedido y paquete traducidos a etiquetas, descripciones y tonos consistentes.

### F4 — shell administrativo

- Layout operativo responsive con sidebar de escritorio, drawer móvil, topbar e identidad de sesión.
- `/app/dashboard`: seis KPIs, tendencia de ventas accesible y alertas operativas con enlaces.
- Rutas y permisos de navegación declarados para productos, inventario, pedidos, paquetes, clientes, usuarios, roles, reportes y configuración.
- Pantalla genérica y honesta de “próxima fase” para módulos no implementados.

### Pruebas existentes

- Primitivas presentacionales y semántica básica.
- Saneamiento de rutas, guards, permisos y adapter de autenticación demo.
- Cálculos y límites del reducer de carrito.
- Filtros y relacionados del servicio mock de productos.
- Aislamiento de pedidos y paquetes por cliente.
- Limpieza de caché privada y sincronización de identidad entre sesión y adapters mock.
- Búsqueda de paquetes por código o descripción de contenido.
- Orden cronológico, estados repetidos, excepciones y pasos futuros del timeline.
- Fechas calendario sin desplazamiento por zona horaria.
- Validación accesible y feedback de éxito del formulario de contacto.
- Smoke E2E visual, búsqueda por contenido y comportamiento modal del drawer administrativo.

## Verdad actual de las rutas

| Ruta o grupo | Estado | Alcance real hoy |
| --- | --- | --- |
| `/`, `/productos`, `/productos/:slug`, `/nosotros`, `/contacto` | **DONE** | experiencia pública funcional con mocks |
| `/carrito` | **DONE** | estado local; no reserva stock ni compra |
| `/login` | **DONE** | validación y sesiones demo; no autenticación remota |
| `/registro` | **NEXT** | solo redirige a login; no hay flujo de registro |
| `/checkout` | **LATER** | no hay ruta; CTA deshabilitado |
| `/mi-cuenta` y rutas de pedidos/paquetes | **DONE** | datos privados del cliente mock actual |
| `/mi-cuenta/perfil` | **DONE** | consulta de identidad; edición pendiente |
| `/app/dashboard` | **DONE** | dashboard mock funcional |
| `/app/products` | **NEXT** | shell-only; contrato público de productos no cubre aún todas las mutaciones staff |
| `/app/inventory` | **NEXT** | shell-only; dominio, query y adapter de lectura ya existen |
| `/app/orders/*` | **NEXT** | shell-only; no existe workflow operativo |
| `/app/packages/*` | **NEXT** | shell-only; no existe workflow operativo |
| `/app/customers` | **NEXT** | shell-only; contrato de lectura existe |
| `/app/users`, `/app/roles` | **NEXT** | shell y permisos solamente |
| `/app/reports`, `/app/settings` | **LATER** | shell solamente; posteriores a los flujos operativos núcleo |
| rutas específicas `/app/products/:id`, `/app/inventory/movements`, `/app/customers/:id` | **NEXT** | aún no están declaradas de forma específica |

## NEXT — siguiente entrega frontend-first

### 1. Cerrar los módulos operativos núcleo

Implementar en incrementos pequeños, cada uno detrás de su contrato y adapter mock:

1. **Productos staff**: listado, búsqueda, filtros, detalle, creación, edición, publicación/activación y confirmación para acciones destructivas. Añadir rutas específicas y permisos por acción.
2. **Inventario**: listado denso responsive, stock mínimo, lotes, ubicación, vencimiento, filtros y movimientos. Los ajustes requieren motivo, confirmación, éxito/error e invalidación de queries.
3. **Pedidos staff**: cola, filtros, detalle y transiciones válidas de estado. Cancelación y reembolso deben ser explícitos y confirmados.
4. **Paquetes staff**: recepción, almacenamiento, cambio de estado, ubicación, entrega y registro de eventos de trazabilidad. No permitir saltos inválidos de estado.
5. **Clientes staff**: listado, detalle y edición autorizada sin reutilizar los endpoints semánticos de “cliente actual”.
6. **Usuarios y roles**: listado y edición de permisos con feedback claro. La UI ayuda a prevenir errores, pero no sustituye autorización del backend.

Los contratos actuales de pedido y paquete son deliberadamente customer-scoped. Las operaciones staff deben recibir contratos propios o métodos claramente separados; no se debe ampliar un método privado para aceptar libremente un `customerId` desde una pantalla.

### 2. Completar calidad UX y accesibilidad

- Mantener las regresiones del drawer y evaluar una primitiva de diálogo accesible si incorpora animaciones, submenús o contenido dinámico más complejo.
- Añadir skip links a los shells cliente y administrativo.
- Definir una experiencia protegida de 404 dentro de cliente y administración para conservar contexto y navegación.
- Revisar foco tras navegación y mutaciones, zoom al 200 %, teclado completo y `prefers-reduced-motion`.
- Mantener revisión visual en 375/768/1024/1440 y ampliar capturas al catálogo filtrado, carrito con productos y shells privados.

### 3. Completar comportamiento público y cliente pendiente

- Decidir el alcance de `/registro`; mientras no exista alta real o contrato mock explícito, mantenerlo identificado como placeholder y no presentarlo como funcional.
- Añadir edición de perfil mediante contrato, esquema Zod, estados de mutación y feedback.
- Introducir paginación visible cuando catálogo, pedidos, paquetes y tablas administrativas excedan el tamaño de página.
- Crear un contrato de contacto antes de conectar envío; la página no debe llamar transporte directamente.
- Revisar disponibilidad concurrente del carrito antes de cualquier checkout futuro; el stock mostrado por el mock no es una reserva.

### 4. Elevar cobertura automatizada

- Pruebas de interacción del formulario de login y futuras mutaciones staff.
- Pruebas de render para todos los estados de pedido y paquete.
- Pruebas de navegación filtrada por cada perfil de permisos, no solo del guard aislado.
- Pruebas de loading/error/empty/success en catálogo, cliente y dashboard.
- Ampliar `pnpm test:e2e` con los flujos aún no cubiertos en navegador: producto → carrito; login demo → pedido propio; y permiso staff permitido/denegado.
- Mantener `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` como gate de cada incremento.

## LATER — fases posteriores

### F6 — ecommerce

- `/checkout` responsive.
- Datos de retiro o despacho y validación de formulario.
- Reserva de stock y resolución de cambios de disponibilidad.
- Estado de pago y experiencia de error/reintento.
- Confirmación de compra e historial actualizado.
- Decisión explícita sobre persistencia segura del carrito.

El procesamiento de pagos y la reserva autoritativa pertenecen al backend; el frontend solo representará sus estados.

### F7 — integración backend

- Adaptadores HTTP por feature, sin cambios estructurales en páginas.
- Validación con Zod de respuestas externas en el límite.
- Sesión real controlada por servidor; no usar `localStorage` como frontera de seguridad.
- Autorización, propiedad de registros y permisos revalidados por backend.
- Mutaciones, invalidación de cache, concurrencia y errores de red reales.
- Configuración de tenant obtenida de una fuente autoritativa cuando se incorpore una segunda organización.
- Envío real de contacto y recuperación/registro de cuenta solo cuando existan contratos seguros.

### Capacidades administrativas secundarias

- Reportes operativos acotados y exportaciones.
- Configuración de organización y marca.
- Auditoría completa de cambios e importaciones con errores por fila.
- Integraciones de correo, identidad externa o courier, si se priorizan y existe backend.

## Fuera del milestone actual

No forman parte de esta entrega:

- microservicios, Kubernetes o GraphQL;
- aplicaciones móviles nativas;
- funciones de IA;
- integraciones con couriers;
- BI complejo;
- autorización de backend implementada desde el frontend;
- procesamiento de pagos;
- reutilización directa de módulos legacy, JWT en `localStorage` o secretos históricos.

## Definition of done para cada item NEXT

Un item solo pasa a DONE cuando:

1. su ruta y comportamiento completos reemplazan el shell;
2. usa tipos de dominio y contrato de servicio, sin fixture o `fetch` en la pantalla;
3. cubre loading, error, empty, normal, success y disabled según aplique;
4. las acciones destructivas solicitan confirmación accesible;
5. permisos y propiedad de datos están modelados correctamente;
6. funciona con teclado y en 375/768/1024/1440 sin overflow inesperado;
7. tiene pruebas proporcionales al riesgo;
8. pasan lint, typecheck, tests y build; Playwright también cuando cambia un flujo crítico;
9. la documentación se actualiza si cambia una decisión arquitectónica.
