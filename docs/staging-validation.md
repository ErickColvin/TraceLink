# Validación de staging

## Ambiente

| Campo | Estado |
| --- | --- |
| fecha | no ejecutada |
| commit/SHA | pendiente |
| frontend URL | POR DEFINIR |
| API URL | POR DEFINIR |
| database | Railway staging POR CREAR |
| payment provider | Mercado Pago TEST POR CONFIGURAR |
| email provider | Resend test POR CONFIGURAR |

No se dispone de credenciales, URLs ni acceso a proveedores en este workspace. Ningún caso externo está marcado como aprobado.

## Smoke

- [ ] frontend responde HTTPS;
- [ ] deep links `/mi-cuenta`, `/app/orders/:id` y `/checkout/resultado` cargan la SPA;
- [ ] `/api/v1/health` responde 200;
- [ ] `/api/v1/health/ready` responde 200 con PostgreSQL accesible;
- [ ] no aparecen secretos en logs/respuestas.

Comando cuando existan URLs:

```powershell
$env:SMOKE_WEB_URL="https://<staging-web>"
$env:SMOKE_API_URL="https://<staging-api>"
node tools/smoke-deployment.mjs
```

## Auth y seguridad HTTPS

- [ ] register -> cookie `__Host-`, HttpOnly, Secure, SameSite esperado y Path=/;
- [ ] login customer/staff;
- [ ] CORS solo refleja `WEB_ORIGIN` exacto;
- [ ] Origin inválido/ausente rechaza mutation;
- [ ] CSRF ausente e inválido responde 403;
- [ ] expiración responde 401, limpia auth, conserva returnTo seguro y permite nuevo login;
- [ ] HSTS y headers Cloudflare/API presentes;
- [ ] CSP permite únicamente recursos necesarios y no usa `unsafe-eval`.

## Mercado Pago TEST

Registrar para cada caso fecha, order number, provider event ID no secreto, request ID y resultado:

- [ ] approved -> Payment APPROVED, Order PAID, reserva COMMITTED;
- [ ] pending -> sin aprobación por return URL;
- [ ] rejected -> Payment REJECTED sin consumir inventario;
- [ ] cancel pending -> reserva RELEASED;
- [ ] retry -> misma Order, nuevo PaymentAttempt;
- [ ] full refund -> Payment/Order REFUNDED, Refund auditado, stock no se devuelve;
- [ ] webhook firmado válido;
- [ ] firma inválida sin efecto;
- [ ] mismo webhook repetido es idempotente;
- [ ] evento repetido/fuera de orden no revierte terminal;
- [ ] webhook perdido se recupera mediante reconciliation bounded.

## Jobs y email

- [ ] reserva vencida expira dentro de la ventana esperada;
- [ ] cada cron registra JSON y termina correctamente;
- [ ] outbox reintenta un fallo temporal y entrega una sola vez;
- [ ] welcome;
- [ ] order created;
- [ ] payment approved;
- [ ] ready for pickup;
- [ ] cancelled;
- [ ] refunded.

## E2E controlado

- [ ] Register -> Login -> Catalog -> Cart -> Checkout -> Mercado Pago TEST -> webhook -> PAID -> PREPARING -> READY -> COMPLETED;
- [ ] inventario reservado/comprometido/consumido consistente;
- [ ] customer solo ve sus recursos;
- [ ] permisos staff bloquean cancel/refund cuando faltan.

## Resultado

**NOT EXECUTED — MANUAL OWNER ACTION REQUIRED**
