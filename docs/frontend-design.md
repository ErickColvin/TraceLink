# Diseño frontend de TraceLink V2 / CH Market

## Estado y alcance

Este documento describe la implementación presente en `apps/web` al 29 de agosto de 2026 y fija las reglas de diseño para continuarla. No describe una interfaz hipotética: cuando una ruta solo tiene un shell o una pantalla de próxima fase, se indica expresamente.

La experiencia se divide en tres superficies:

1. tienda pública de CH Market;
2. portal privado del cliente;
3. portal operativo para personal.

La tienda debe sentirse comercial y cercana. El portal cliente debe priorizar confianza, privacidad y lectura simple de estados. El portal operativo puede ser más denso, pero debe conservar la misma jerarquía, accesibilidad y lenguaje visual.

## Principios de interfaz

- Presentar primero la tarea y el estado actual; los detalles técnicos quedan en segundo plano.
- Mantener la identidad del cliente implícita en la sesión. No se permite consultar pedidos o paquetes mediante un nombre escrito libremente.
- Comunicar cada estado con texto e iconografía además del color.
- Mantener las páginas como orquestadores pequeños; las reglas de dominio viven en features y los datos detrás de contratos.
- Diseñar mobile first y ampliar la composición en los breakpoints estándar de Tailwind.
- Hacer visible que los datos y accesos actuales son demostrativos cuando una interacción aún no tiene backend.
- Reservar confirmaciones accesibles para mutaciones destructivas persistentes.

## Arquitectura de presentación y datos

```text
Router / layouts / providers
            |
            v
      Pages de feature
            |
            v
 Componentes + query hooks
            |
            v
 Contratos de servicio tipados
            |
            v
 Adaptadores mock actuales ----> adaptadores HTTP futuros
```

Las responsabilidades se reparten así:

- `src/app`: router, providers y configuración global de marca.
- `src/layouts`: shells público, cliente y administrativo.
- `src/components`: primitivas y composiciones reutilizables sin reglas de negocio.
- `src/features/<feature>`: dominio, queries, páginas, componentes propios, contrato de servicio, adapter y fixtures.
- `src/lib`: utilidades transversales, como formato CLP, fechas, iniciales y composición de clases.
- `src/styles`: tokens y estilos base.

Los componentes no llaman `fetch` ni importan fixtures. Los hooks de TanStack Query consumen instancias tipadas exportadas por el `services.ts` de su propia feature; esos módulos son los puntos de composición pequeños que permiten cambiar un adapter sin acoplar todas las features. Actualmente están conectados a `MockProductService`, `MockOrderService`, `MockPackageService`, `MockCustomerService`, `MockInventoryService` y `MockDashboardService`.

Los contratos de pedidos y paquetes del cliente exponen operaciones `listCurrentCustomer` y `getCurrentCustomerById`: la pantalla nunca elige el propietario. `features/mock-context.ts` actúa como puente de identidad exclusivamente entre el adapter de autenticación demo y los demás adapters; cada servicio resuelve allí el cliente activo y filtra también el detalle. Las query keys privadas incluyen esa identidad y se eliminan al restaurar, cambiar o cerrar sesión. Un adapter HTTP futuro deberá resolver la identidad en el servidor y responder como no encontrado ante registros fuera del alcance del usuario.

La autenticación usa una frontera equivalente mediante `AuthService`, inyectable en `AuthProvider`. El adapter demo no valida ni retiene credenciales, no emite tokens, no usa almacenamiento del navegador y pierde la sesión al recargar. La autorización del frontend solo controla navegación y feedback de UX; el backend futuro deberá volver a comprobar identidad y permisos.

TanStack Query administra estado con semántica de servidor. El carrito y la sesión demo son estado local: el carrito usa un reducer puro dentro de `CartProvider`, limita cantidades al stock conocido y no persiste entre recargas.

Para sustituir un mock por HTTP se debe:

1. conservar o evolucionar explícitamente el contrato de la feature;
2. crear un adapter HTTP que valide la respuesta externa en el límite;
3. cambiar la composición del servicio, no las páginas;
4. conservar las query keys y revisar invalidaciones para las nuevas mutaciones;
5. mantener loading, error, empty, success y disabled en la pantalla.

## Marca y tokens centralizados

La configuración de tenant vive en `src/app/config/brand.ts`:

| Campo | Valor actual | Uso |
| --- | --- | --- |
| `name` / `shortName` | `CH Market` / `CH` | logotipo, encabezados y textos de marca |
| `descriptor` | Congelados y productos para tu día a día | posicionamiento comercial |
| `organization` | Colvin Solutions | atribución de plataforma |
| `locale` | `es-CL` | moneda, fechas e iniciales |
| `currency` | `CLP` | precios enteros sin decimales |
| `timezone` | `America/Santiago` | fechas y horas visibles |
| `serviceArea` | Huechuraba, Santiago | información de contacto |

Los datos de marca nuevos deben agregarse a esta configuración; no se deben repartir nombres, locale, moneda, zona horaria ni identificadores de organización entre componentes. Los formateadores reutilizan esta configuración y `formatClp` redondea a pesos enteros.

Los tokens visuales viven en `src/styles/index.css` mediante `@theme`:

- `brand-50` a `brand-950`: azul CH Market para identidad, enlaces, foco y superficies principales; sus extremos actuales son `#eff8fc` y `#0b2635`.
- `ice-50` a `ice-500`: fondos fríos y superficies secundarias; parte en `#f7fbfc`.
- `coral-50` a `coral-700`: llamada comercial, atención, advertencia y peligro; el acento principal es `coral-500` (`#c1490e`) para mantener contraste AA con texto blanco.
- `ink-50` a `ink-950`: texto, bordes y neutrales; el texto principal es `ink-950` (`#172027`).
- `shadow-soft`, `shadow-card` y `shadow-lifted`: elevación progresiva sin recrear sombras arbitrarias por página.
- `font-sans`: Segoe UI/Inter y fallbacks del sistema; `font-display`: Aptos Display/Segoe UI y fallbacks del sistema.

La composición usa fondos claros, azul profundo para shells y coral de forma acotada. No existe tema oscuro en el alcance actual. El único activo legacy reutilizado es `/assets/ch-market-hero.jpg`; sirve como hero y fallback de imagen. Las imágenes funcionales deben tener texto alternativo significativo; las redundantes con texto adyacente pueden ser decorativas.

Los contenedores públicos y de cliente usan normalmente `max-w-7xl` (1280 px), padding horizontal de 16 px, 24 px desde `sm` y 32 px desde `lg`. Las tarjetas usan bordes suaves, radio de 16 px y `shadow-card`. Los controles `md` e `icon` miden 44 px de alto; el tamaño compacto `sm` se reserva para acciones secundarias.

## Layouts

### Público

`PublicLayout` contiene:

- skip link hacia `#contenido-principal`;
- franja superior con propuesta de servicio y acceso privado a seguimiento;
- encabezado sticky con marca, navegación, carrito e inicio de sesión;
- menú desplegable bajo el encabezado en anchos menores a `lg`;
- contenido mediante `Outlet`;
- footer de marca, navegación y accesos de cuenta.

La navegación de escritorio aparece desde 1024 px. El menú móvil informa `aria-expanded`, se cierra al navegar y permite cerrar con Escape, devolviendo foco al botón que lo abrió. El contador del carrito tiene nombre accesible y limita su representación visual a `9+`.

### Cliente

`CustomerLayout` muestra marca y resumen de identidad en el encabezado. En móvil y tablet usa una barra horizontal desplazable para Resumen, Mis pedidos, Mis paquetes y Mi perfil. Desde 1024 px usa una columna lateral sticky de 230 px y deja el contenido en una segunda columna flexible. El cierre de sesión presenta error visible si falla y vuelve al inicio si termina correctamente.

Las páginas privadas solo se renderizan detrás de `CustomerRoute`. Una sesión anónima va a login conservando un `returnTo` interno saneado; una sesión de personal se redirige al dashboard administrativo.

### Personal / administración

`AdminLayout` usa una barra lateral azul de 260 px desde 1024 px y un drawer sobre backdrop en tamaños menores. El encabezado operativo permanece sticky y muestra el nombre de la sección, notificaciones e identidad del personal. La navegación se filtra con permisos granulares y cada ruta vuelve a aplicar su guard correspondiente.

El drawer declara `role="dialog"` y `aria-modal`, mueve el foco al control de cierre, contiene la navegación por Tab, cierra por backdrop o Escape y devuelve el foco al botón que lo abrió. Mientras está visible, el contenido de fondo queda `inert` y el scroll del documento se bloquea; ambos estados se restauran al cerrar.

## Rutas y navegación implementadas

### Superficie pública

| Ruta | Destino actual | Entrada de navegación |
| --- | --- | --- |
| `/` | home comercial con hero, categorías, destacados, beneficios y CTA | logo e Inicio |
| `/productos` | catálogo con búsqueda, categoría, disponibilidad y orden | navegación y CTAs |
| `/productos/:slug` | detalle, cantidad, alta al carrito y relacionados | tarjetas de producto |
| `/nosotros` | propuesta y compromisos de CH Market | navegación y footer |
| `/contacto` | formulario validado de demostración, sin envío real | navegación y footer |
| `/carrito` | carrito local, cantidades y total estimado | icono del encabezado |
| `/registro` | redirección temporal a `/login` | sin flujo propio |
| `/login` | pantalla independiente de acceso y demos | encabezado, footer y guards |
| cualquier otra ruta pública | página 404 | fallback del router |

`/checkout` todavía no existe. El botón correspondiente permanece deshabilitado dentro del carrito.

### Portal cliente

| Ruta | Destino actual |
| --- | --- |
| `/mi-cuenta` | resumen privado de pedidos y paquetes |
| `/mi-cuenta/pedidos` | listado de pedidos propios |
| `/mi-cuenta/pedidos/:id` | productos, estado y resumen de un pedido propio |
| `/mi-cuenta/paquetes` | búsqueda y listado de paquetes propios |
| `/mi-cuenta/paquetes/:id` | detalle, información y timeline tipado |
| `/mi-cuenta/perfil` | perfil autenticado de solo lectura |

### Portal administrativo

| Ruta | Estado de la vista |
| --- | --- |
| `/app` | redirige a `/app/dashboard` |
| `/app/dashboard` | dashboard funcional con KPIs, tendencia y alertas mock |
| `/app/products` | shell con pantalla de próxima fase |
| `/app/inventory` | shell con pantalla de próxima fase |
| `/app/orders/*` | shell con pantalla de próxima fase |
| `/app/packages/*` | shell con pantalla de próxima fase |
| `/app/customers` | shell con pantalla de próxima fase |
| `/app/users` | shell con pantalla de próxima fase |
| `/app/roles` | shell con pantalla de próxima fase |
| `/app/reports` | shell con pantalla de próxima fase |
| `/app/settings` | shell con pantalla de próxima fase |
| otra ruta bajo `/app` | shell genérico de módulo no disponible |

Los detalles `/app/products/:id`, `/app/inventory/movements` y `/app/customers/:id` aún no tienen rutas específicas. Los paths de detalle bajo pedidos y paquetes quedan absorbidos por sus comodines y muestran el mismo shell, no una vista operacional.

## Componentes reutilizables

### Primitivas de UI

- `Button` y `buttonStyles`: variantes `primary`, `secondary`, `outline`, `ghost` y `danger`; tamaños `sm`, `md`, `lg` e `icon`. `buttonStyles` permite que un `Link` conserve el mismo contrato visual.
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` y `CardFooter`: estructura consistente para superficies y resúmenes.
- `Badge`: tonos `neutral`, `brand`, `info`, `success`, `warning` y `danger`; siempre debe contener una etiqueta textual.
- `Alert`, `AlertTitle` y `AlertDescription`: feedback inline; el tono danger recibe `role="alert"` por defecto.
- `Input` y `Label`: controles con hover, foco, disabled y `aria-invalid` visibles.

### Composiciones compartidas

- `BrandLogo`: marca completa o compacta, manteniendo el nombre para lectores de pantalla.
- `PageHeader`: `h1`, eyebrow, descripción y acciones de página.
- `SectionHeading`: encabezado de sección con alineación inicial o centrada.
- `Spinner` y `LoadingSkeleton`: progreso anunciado y skeletons sin movimiento cuando el usuario lo reduce.
- `ErrorState`: error de página o sección, anunciado y con acción opcional.
- `EmptyState`: ausencia válida de resultados con explicación y CTA opcional.

### Componentes de feature

- `ProductCard`: imagen, categoría, disponibilidad, precio CLP y enlace al detalle.
- `ProductGridSkeleton`: mantiene la geometría de la grilla mientras carga.
- `TrackingTimeline`: representa pasos estándar, próximos pasos y excepciones con evento, fecha, ubicación, texto e icono.

Una composición pasa a `src/components` solo si es independiente del dominio. Si conoce `Product`, `Order`, `Package` o una regla de negocio, permanece bajo su feature.

## Comportamiento responsive

Los puntos de control corresponden a los breakpoints activos de Tailwind: `sm` 640 px, `md` 768 px, `lg` 1024 px, `xl` 1280 px y `2xl` 1536 px. La hoja base admite desde 320 px.

| Viewport de revisión | Comportamiento esperado en la implementación actual |
| --- | --- |
| 375 px | Navegación pública mediante menú; botón de login textual oculto y carrito visible. Hero, filtros, producto, carrito y contenido cliente quedan en una columna. El cliente usa navegación horizontal desplazable. Administración usa drawer. Las acciones principales se apilan o ocupan el ancho disponible. |
| 768 px | Se activan composiciones `md`: filtros del catálogo en dos columnas, footer público en tres, paquetes en dos y compromisos de Nosotros en tres. Las grillas de producto ya muestran dos columnas por `sm`. Público, cliente y administración todavía usan sus patrones de navegación móvil/tablet porque `lg` no está activo. |
| 1024 px | Se activan la navegación pública de escritorio, sidebar cliente de 230 px y sidebar administrativa de 260 px. Hero, detalle de producto y Contacto usan dos columnas; catálogo usa cinco áreas de filtro y tres productos por fila; carrito separa listado y resumen sticky. |
| 1440 px | `max-w-7xl` centra las superficies públicas en 1280 px. El catálogo usa cuatro productos por fila por `xl`; los detalles cliente habilitan su aside de 320 px. El dashboard administrativo aún apila gráfico y alertas porque su división usa `2xl` y comienza recién a 1536 px. |

`tools/visual-review.mjs` ofrece un smoke E2E headless de home en 375/768/1024/1440, más catálogo, detalle, login, búsqueda/timeline cliente y dashboard. Detecta overflow horizontal global y verifica el comportamiento modal del drawer. Es una primera barrera automatizada; no sustituye una suite Playwright más amplia ni la validación manual de teclado, zoom y lectores de pantalla.

## Accesibilidad

Patrones ya presentes:

- HTML semántico con `header`, `nav`, `main`, `section`, `article`, `aside`, listas y encabezados jerárquicos.
- skip link visible al foco en la superficie pública.
- nombres accesibles en navegaciones, botones de icono, carrito, gráfico y timeline.
- iconos decorativos con `aria-hidden` y feedback asíncrono con `role="status"`, `role="alert"` o `aria-live` según urgencia.
- labels nativos, fieldset/legend en el tipo de acceso y errores visibles en formularios.
- foco global de tres píxeles y rings específicos en controles.
- estados con etiqueta textual; el color nunca es la única señal.
- `prefers-reduced-motion` desactiva scroll suave, animaciones y transiciones largas.
- `returnTo` solo acepta paths internos, evita cruces entre audiencia cliente/personal y rechaza barras invertidas, rutas de protocolo y caracteres de control.

Trabajo obligatorio al extender la interfaz:

- añadir skip links equivalentes a los shells privados;
- verificar foco tras navegación, errores y mutaciones;
- probar al 200 % de zoom, solo teclado y movimiento reducido;
- usar un diálogo accesible con confirmación explícita para eliminar, cancelar, entregar, ajustar inventario u otras acciones persistentes de riesgo.

## Estados de UX

| Estado | Patrón |
| --- | --- |
| Loading | skeleton que conserva la forma del contenido; spinner para acción breve; texto de carga para restauración de sesión |
| Empty | `EmptyState` con explicación útil y CTA solo cuando existe una recuperación razonable |
| Error | `ErrorState` o `Alert` con lenguaje accionable; `Reintentar` vuelve a ejecutar la query cuando aplica |
| Success | `Alert tone="success"` y región live para confirmaciones, como agregar al carrito o preparar contacto |
| Disabled | atributo nativo `disabled`, contraste visible y texto que explica una capacidad futura cuando corresponde |
| Not found / fuera de alcance | mensaje deliberadamente indistinguible en detalles privados para no revelar existencia de registros ajenos |
| Normal | contenido estable, estado textual, fechas en zona de Santiago y montos en CLP |

Las pantallas que agreguen mutaciones deben definir además estado pending por acción, prevención de doble envío, feedback de éxito/error e invalidación de las queries afectadas. Los gaps concretos de la implementación actual están priorizados en `docs/frontend-roadmap.md`.
