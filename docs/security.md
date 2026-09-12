# Seguridad de TraceLink V2

## Modelo de confianza

La API y PostgreSQL son la frontera autoritativa. El frontend puede ocultar acciones para mejorar UX, pero cada request vuelve a comprobar sesión, audiencia, tenant, ownership, permiso, schema y regla de negocio.

No son fuentes de autoridad:

- `organizationId`, `customerId`, `userId` o `actor` enviados por el navegador;
- reglas de transición ejecutadas solo en React;
- disponibilidad o totales calculados solo en el cliente;
- estado de retorno de `/checkout/resultado`;
- body de webhook no verificado o no reconciliado contra el provider;
- la visibilidad de un botón.

## Sesiones

- Login crea 32 bytes aleatorios y entrega `v1.<base64url>` únicamente por cookie.
- PostgreSQL conserva solo HMAC-SHA-256 del token bajo un secreto independiente.
- Session relaciona User, Organization y exactamente Customer o Membership según audiencia.
- Existe expiración absoluta y timeout por inactividad.
- La sesión se revoca en logout, al deshabilitar la Membership/User y por timeout.
- `/auth/me` reconstruye el contexto actual; no confía en claims guardados por el navegador.
- El frontend no usa localStorage, sessionStorage ni IndexedDB para identidad.

Cookie de producción:

```text
__Host-tl_session
HttpOnly
Secure
SameSite=Lax
Path=/
sin Domain
Priority=High
```

Desarrollo usa un nombre separado y omite `Secure` únicamente para localhost HTTP. Producción debe terminar TLS antes de exponer el origen.

## Passwords

Las contraseñas se hashean con Argon2id (`memoryCost=19 MiB`, `timeCost=2`, `parallelism=1`, hash de 32 bytes). Login ejecuta una verificación dummy cuando el email no existe para reducir enumeración temporal y devuelve el mismo error para identidad inexistente, password incorrecto o audiencia incorrecta.

Nunca se registran ni devuelven password/passwordHash. El seed exige credenciales mediante variables locales y también genera hashes Argon2id. Requiere `NODE_ENV` explícito en `development` o `test` y rechaza producción y placeholders documentados antes de hashear o conectarse a PostgreSQL.

## CSRF, Origin y CORS

Las mutaciones autenticadas requieren:

1. cookie de sesión válida;
2. Origin idéntico a `WEB_ORIGIN`;
3. `X-CSRF-Token` válido.

El token CSRF contiene nonce y HMAC ligado a `sessionId` y al hash de la sesión. Login y `/auth/me` lo entregan en el envelope; HttpClient lo conserva solo en memoria, lo rota al cambiar sesión y lo limpia al cerrar sesión.

CORS no usa wildcard con credenciales. Permite solo el origen configurado, métodos/headers conocidos y expone request ID, replay idempotente y Retry-After. SameSite es defensa adicional, no sustituto de CSRF.

## RBAC

Membership enlaza User + Organization + Role. RolePermission usa el catálogo compartido de 19 claves. Las rutas staff ejecutan:

```text
authenticate -> requireStaff -> requirePermission -> validate -> service
```

Deshabilitar un acceso revoca sesiones de esa organización. SUPER_ADMIN mantiene invariantes de permisos y no se aceptan strings arbitrarios.

## Aislamiento tenant y customer

- El tenant público se resuelve desde `ORGANIZATION_SLUG` del despliegue.
- El tenant privado procede de Session.
- Repositories reciben `organizationId` obligatorio y lo incluyen en predicates/joins.
- Foreign keys compuestas impiden relacionar filas entre organizaciones.
- `/me` añade el `customerId` de Session a la consulta por ID.
- Un ID inexistente, de otro tenant o de otro customer responde `404` indistinguible cuando corresponde.

La suite PostgreSQL intenta cruces con IDs reales de otro scope para verificar que no sean legibles ni mutables.

## Integridad transaccional

- InventoryBalance se bloquea antes de aplicar deltas.
- Checks impiden físico/reservado negativo o reservado superior al físico.
- InventoryMovement es un ledger inmutable con snapshots.
- State machines de Order/Package se validan en servidor.
- Evento, entidad, auditoría e idempotencia comparten la transacción crítica.
- PICKED_UP y CANCELLED solo usan acciones dedicadas.

## Idempotencia

Las operaciones que pueden duplicar efectos exigen `Idempotency-Key`. Solo se persisten HMAC de clave/request, scope por tenant y actor, resultado reproducible y expiración.

- misma clave + mismo request: replay exacto y header `Idempotency-Replayed: true`;
- misma clave + payload distinto: `409 IDEMPOTENCY_CONFLICT`;
- ausencia de clave: `400 IDEMPOTENCY_KEY_REQUIRED`;
- registros vencidos: poda oportunista.

## Código de retiro

Package guarda únicamente HMAC-SHA-256 ligado a tenant y package ID. La comparación es constante, tiene rate limit, comprueba expiración y se consume al entregar. La respuesta y AuditLog nunca incluyen hash ni texto plano. El canal productivo de provisión/rotación del código aún debe definirse antes de habilitar notificaciones.

## Rate limiting

Los límites se persisten en PostgreSQL para sobrevivir reinicios de proceso. Auth aplica scopes independientes por IP y por identidad normalizada, por lo que rotar emails no renueva el presupuesto global. Las IP se validan y canonicalizan —incluido IPv4 mapeado en IPv6— antes de formar el HMAC; un valor forwarded inválido cae a la dirección del socket y no a una clave controlada por el solicitante. Un éxito puede limpiar el contador específico de cuenta, pero no el de IP. Los buckets vencidos se podan de forma oportunista y su expiración está indexada.

La entrega de paquetes tiene un scope adicional por tenant, actor, package e IP. Los rechazos usan `429 RATE_LIMITED` y `Retry-After` sin revelar existencia de cuentas.

## Proxy confiable

`TRUST_PROXY` es `false` por defecto. Nunca se acepta `true` irrestricto. Si el despliegue usa reverse proxy, debe configurarse un número de hops o una lista explícita de IP/CIDR que coincida con la topología, y el origin de la API debe bloquear acceso directo. Una configuración incorrecta permitiría falsificar la IP usada por rate limit.

## Logging, auditoría y errores

- Pino emite JSON estructurado con servicio, entorno y request ID.
- El request logger conserva solo método, URL redactada, IP y status; no serializa body ni headers completos.
- La redacción recursiva cubre password, authorization, cookie, CSRF, session, secrets, tokens y pickup code, incluidos aliases, objetos anidados, JSON textual y nombres codificados en rutas/parámetros URL.
- AuditLog registra tenant, actor, acción, entidad, snapshots permitidos y request ID.
- Los errores 5xx se registran internamente, pero la respuesta usa `INTERNAL_ERROR` sin stack.
- El límite JSON reduce payloads abusivos y Helmet aplica cabeceras defensivas.

## Secretos

`SESSION_SECRET`, `CSRF_SECRET`, `IDEMPOTENCY_SECRET`, `RATE_LIMIT_SECRET` y `PICKUP_CODE_SECRET` deben ser valores aleatorios, independientes y de al menos 32 bytes. No se deben reutilizar placeholders, credenciales legacy ni secretos entre ambientes.

`.env` no se versiona. Producción debe usar el secret manager de la plataforma y rotación planificada; rotar el secreto de Session invalida cookies existentes.

## Cookies y HTTPS de Fase 5

Local usa `tl_session_dev`, sin Secure y `SameSite=Lax`. Staging/production usan `__Host-tl_session`, HttpOnly, Secure, Path=/ y sin Domain. Para los dominios técnicos cross-site de Cloudflare/Railway se configura `SESSION_COOKIE_SAME_SITE=none`; la configuración rechaza `none` sin Secure. Si los custom domains quedan bajo el mismo site, se puede evaluar `lax` después de probar login, checkout y expiración.

Helmet habilita HSTS solo fuera de local. Cloudflare sirve CSP, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`. El frontend escucha respuestas 401, elimina su estado autenticado/cache privada y los guards producen un `returnTo` interno saneado.

La suite local prueba primitives, headers, Origin/CORS y CSRF. El comportamiento de cookies/CSRF sobre HTTPS real continúa pendiente y se registra en `docs/staging-validation.md`.

## Cobertura de seguridad

Las pruebas explícitas cubren:

- CSRF ausente, inválido y manipulado;
- Origin/CORS no permitido;
- ID cross-tenant y cross-customer;
- permiso denegado;
- sesión revocada, expirada y de cuenta deshabilitada;
- login inválido indistinguible y rate limit con rotación de email;
- transición inválida de pedidos/paquetes;
- inventario negativo;
- replay y conflicto idempotente;
- pickup code inválido/consumido;
- redacción de secretos y validación de proxy.

La matriz mantenida por la suite está en `apps/api/tests/SECURITY-COVERAGE.md`.

## Checklist antes de producción

1. Servir frontend/API sobre HTTPS y verificar cookie `__Host-` y SameSite según topología.
2. Inyectar secretos distintos desde un secret manager.
3. Restringir red del origin API al proxy autorizado.
4. Configurar `WEB_ORIGIN` exacto y `TRUST_PROXY` según topología real.
5. Ejecutar migraciones como paso controlado, no al arrancar cada réplica.
6. Configurar backups, restauración ensayada y retención de AuditLog.
7. Definir alertas de errores 5xx, readiness, latencia, rate limit y saturación DB.
8. Definir provisión segura del código de retiro y recuperación de cuenta.
9. Ejecutar lint, tipos, unit, API, integración, seguridad y E2E en CI.
10. Validar manualmente credenciales sandbox Mercado Pago, URLs HTTPS públicas y secreto de webhook antes de activar provider real.
