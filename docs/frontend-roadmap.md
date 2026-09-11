# Roadmap de TraceLink V2 / CH Market

Corte de estado: 6 de septiembre de 2026.

`DONE` significa que el alcance solicitado está implementado, documentado y verificado por sus gates. El modo mock continúa disponible, pero desde Fase 3 la API y PostgreSQL son la fuente autoritativa cuando `VITE_DATA_MODE=http`.

## PHASE 1 — DONE

### Frontend foundation

- Workspace pnpm, React, TypeScript estricto, Vite, Tailwind, React Router y TanStack Query.
- Arquitectura por features, contratos de servicio, configuración de marca central y montos CLP enteros.
- Primitivas accesibles, layouts responsive, estados async y base de tests Vitest/RTL/Playwright.

## PHASE 2 — DONE

### Frontend operational

- Storefront público, catálogo, detalle, carrito y checkout visual.
- Portal customer con perfil, pedidos, paquetes y trazabilidad.
- Portal staff con dashboard, productos, inventario/movimientos, pedidos, paquetes, clientes, usuarios, roles, reportes y settings.
- Guards, permisos de UX, formularios validados, confirmaciones y adapters mock mutables.
- Revisión responsive en 375, 768, 1024 y 1440 px con 29 capturas.

## PHASE 3 — DONE

### Backend + persistence + real auth + HTTP integration

- API modular Express 5 sobre Node.js 24, TypeScript strict y contratos Zod compartidos.
- PostgreSQL 18 con 25 modelos, siete migraciones incrementales, constraints e índices tenant-aware.
- Organization, User, Customer, Membership, Role, Permission y RolePermission separados.
- Sesiones server-side revocables: token opaco en cookie HttpOnly, solo HMAC en DB, Argon2id, CSRF ligado a sesión y Origin/CORS exactos.
- Enforcement autoritativo de RBAC, tenant y ownership customer; recursos fuera de scope responden como no encontrados cuando corresponde.
- Productos/clientes persistidos; inventario transaccional con ledger inmutable y dominio de reservas preparado.
- Pedidos y paquetes persistidos con state machines, eventos, auditoría, idempotencia y código de retiro hasheado/consumible.
- Usuarios, roles, settings, dashboard y reportes conectados a datos reales.
- HttpClient central con cookies, CSRF, request ID, errores, Zod e idempotencia; 14 adapters HTTP implementan los 48 métodos de servicio sin reconstruir pantallas.
- Seed idempotente de CH Market con roles/permisos, tres identidades, catálogo, inventario, pedidos, paquetes y tracking. Producción/placeholders se rechazan antes de conectar.
- E2E HTTP real: PostgreSQL aislado, migraciones, seed, API, Vite y browser; customer observa las mutaciones persistidas realizadas por staff.
- Hardening de rate limits por cuenta/IP canónica, proxy explícito, redacción profunda de logs y teardown verificable.

Verificación de cierre:

```text
contracts:             10 tests
frontend:             129 tests
backend unit:          70 tests
backend API:           12 tests
backend integration:   33 tests / 8 files
E2E HTTP real:          8 checkpoints críticos
lint:                   PASS
typecheck:              PASS
build:                  PASS
migration check:        PASS
```

## PHASE 4 — DONE

### Ecommerce + reservations + payments

1. Checkout visual convertido en creación autoritativa de order.
2. InventoryReservation conectado al checkout con expiración, liberación, commit y consumo.
3. PaymentProvider con adapter fake para tests y Mercado Pago Orders API para sandbox.
4. Webhook firmado, deduplicado y reconciliado por consulta autoritativa al provider.
5. Pedido confirmado solo por Payment `APPROVED`; la return URL no cambia estados.
6. Reintento de pago sobre la misma order y cancelación customer de `PENDING_PAYMENT`.
7. Full refund staff con permiso, motivo, confirmación e idempotencia.
8. Registro público customer activado en `/registro`.

## PHASE 5 — LATER

### Production + notifications + monitoring

- Despliegue HTTPS, secret manager, proxy/red privada, backups y restauración ensayada.
- Observabilidad, alertas, retención de auditoría y runbooks operativos.
- Email/SMS/WhatsApp y provisión segura del código de retiro.
- Recuperación/verificación de cuenta, uploads de imágenes y couriers.
- Segunda organización y validación multi-tenant en un despliegue real.

## Límites deliberados al cierre

Fase 4 no activa cobros productivos, dominio/SSL/deploy, notificaciones reales, couriers, uploads, Redis, colas, microservicios, Kubernetes, BI externo ni aplicaciones nativas.

Las mejoras visuales priorizadas —errores con request ID, expiración centralizada de sesión, reintentos idempotentes visibles, selector remoto de inventario y ajustes móviles— están documentadas en `docs/ui-review-phase-3.md` para no mezclar un rediseño con la integración backend.
