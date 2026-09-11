# Webhooks de pago de Fase 4

Este documento define la recepción segura y la reconciliación de notificaciones de Checkout Pro con Orders API. Complementa [payments.md](payments.md). Corte documental: 6 de septiembre de 2026.

## Configuración en Mercado Pago

En **Tus integraciones > aplicación > Webhooks > Configurar notificaciones** se registra una URL HTTPS pública de TraceLink y se selecciona el evento **Order (Mercado Pago)**. El tópico recibido es `type: "order"`.

Configuración conceptual por ambiente:

```text
test:       https://<host-sandbox>/api/v1/webhooks/mercadopago
production: https://<host-produccion>/api/v1/webhooks/mercadopago
```

La URL es un endpoint de servidor anónimo dedicado: no usa cookie de sesión ni CSRF, pero exige firma válida. Test y producción usan aplicaciones, `application_id`, `user_id`, Access Token y secreto Webhook separados. El secreto generado en el panel es solo de backend y nunca se incluye en frontend, respuestas, logs, fixtures ni repositorio.

La integración real no puede completarse solo con código: requiere credenciales de prueba, cuenta compradora de prueba chilena, URL HTTPS alcanzable y configuración manual del tópico en la aplicación de Mercado Pago.

Fuente principal: [configuración oficial de notificaciones de Orders](https://www.mercadopago.cl/developers/es/docs/checkout-api-orders/notifications).

## Forma de la notificación e identificadores

Ejemplo oficial de una entrega:

```http
POST /api/v1/webhooks/mercadopago?data.id=ORD01JQ4S4KY8HWQ6NA5PXB65B3D3&type=order HTTP/1.1
Content-Type: application/json
X-Request-Id: 2066ca19-c6f1-498a-be75-1923005edd06
X-Signature: ts=1742505638683,v1=ced36ab6d33566bb1e16c125819b8d840d6b8ef136b0b9127c76064466f5229b

{
  "action": "order.action_required",
  "api_version": "v1",
  "application_id": "76506430185983",
  "date_created": "2021-11-01T02:02:02Z",
  "id": "123456",
  "live_mode": false,
  "type": "order",
  "user_id": 2025701502,
  "data": {
    "id": "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3"
  }
}
```

Los valores son ilustrativos. Cada identificador tiene una función distinta:

| Valor | Significado | Uso en TraceLink |
| --- | --- | --- |
| body `id` | ID único de la notificación/evento | Clave de deduplicación de la entrega. |
| query `data.id` | ID del recurso notificado | Entrada firmada para consulta; debe ser la order `ORD...`. |
| body `data.id` | ID de la order indicado en el evento | Debe coincidir con query `data.id`; nunca sustituye la consulta autoritativa. |
| `X-Request-Id` | ID de la entrega HTTP de Mercado Pago | Parte del manifiesto y correlación de logs/soporte. |
| `external_reference` | Referencia local enviada al crear la order | Correlaciona con la order de TraceLink. |
| `PAY...` | ID de una transacción de pago | No se usa como `order_id`. |
| `REF...` | ID de una transacción de reembolso | Evidencia de refund; no se usa como `order_id`. |

El parser debe leer literalmente el query param `data.id`, incluido el punto. No debe cambiarlo por `data_id`; algunos snippets heredados de otros lenguajes difieren, pero el request y el ejemplo Node oficiales usan `data.id`.

`action` describe el evento y sirve para telemetría o priorización. Entre las acciones documentadas para la familia Orders están `order.processed`, `order.canceled`, `order.refunded`, `order.action_required`, `order.failed` y `order.expired`. La lista no se usa como allowlist cerrada: una acción nueva con firma válida también dispara `GET /v1/orders/{id}`.

## Validación exacta de `X-Signature`

La fuente de los tres componentes es exacta:

- `data.id`: query string;
- `x-request-id`: header HTTP, case-insensitive;
- `ts` y `v1`: pares separados por coma dentro del header `x-signature`.

El manifiesto definido por Mercado Pago es:

```text
id:<data.id>;request-id:<x-request-id>;ts:<ts>;
```

Con los valores del ejemplo:

```text
id:ORD01JQ4S4KY8HWQ6NA5PXB65B3D3;request-id:2066ca19-c6f1-498a-be75-1923005edd06;ts:1742505638683;
```

Reglas de validación:

1. Extraer sin interpolar el body los valores anteriores. Para el tópico order, TraceLink exige que los tres existan; si falta alguno responde `401`.
2. Construir el manifiesto en ese orden, con nombres, guiones, dos puntos y punto y coma exactamente como aparecen. La regla general del SDK omite por completo un par ausente; no agrega un valor vacío.
3. Calcular `HMAC-SHA256(webhookSecret, manifest)` y codificar el resultado hexadecimal en minúsculas.
4. Validar que `v1` tenga forma y longitud de SHA-256 hexadecimal.
5. Comparar los bytes del hash calculado y `v1` en tiempo constante. Nunca usar comparación directa de strings.
6. Una firma inválida produce `401` y ningún cambio de negocio.

Se puede usar `WebhookSignatureValidator` del SDK oficial o una implementación pequeña basada en `node:crypto`, cubierta con vectores de prueba. No se inventa una firma sobre el raw body: el algoritmo oficial firma el manifiesto anterior, no el JSON completo.

El `ts` forma parte de la autenticidad, pero la documentación consultada no fija una ventana máxima de antigüedad para Orders. No se debe introducir un TTL que descarte reintentos legítimos sin validarlo antes en sandbox. La defensa contra replay con efecto de negocio es la deduplicación persistente más la consulta autoritativa.

Fuente del algoritmo: [validación oficial y manifiesto exacto](https://www.mercadopago.cl/developers/en/docs/checkout-api-orders/optional-notifications). El [documento específico de Orders](https://www.mercadopago.cl/developers/es/docs/checkout-api-orders/notifications) muestra los headers y el uso de `WebhookSignatureValidator`.

## Validaciones posteriores a la firma

Una firma válida solo autentica la entrega; todavía se comprueba:

- query y body tienen `type: "order"`;
- query `data.id` y body `data.id` son iguales y tienen formato acotado;
- `application_id` y `user_id` coinciden con la configuración de la organización;
- `live_mode` coincide con `PAYMENT_ENVIRONMENT`;
- el JSON cumple un schema estricto y un límite de tamaño;
- la correlación obtenida después por GET pertenece al mismo tenant y a la misma intención local.

No se acepta `organizationId` en query/body como autoridad. En una futura operación multi-tenant, aplicación o vendedor resuelven una configuración tenant preexistente; un parámetro `client` puede ser una pista de routing, nunca una frontera de seguridad.

## ACK duradero y procesamiento asíncrono

Mercado Pago exige `200 OK` o `201 Created` dentro de 22 segundos. Si no recibe confirmación, reintenta cada 15 minutos; después del tercer intento amplía el intervalo y continúa enviando. El flujo local será:

```text
POST firmado
  -> validar firma, schema y contexto
  -> insertar inbox duradero con clave única
  -> responder 200
  -> worker consulta GET /v1/orders/{id}
  -> conciliación transaccional e idempotente
```

La respuesta rápida ocurre después de asegurar el evento en PostgreSQL, pero antes de llamar a Mercado Pago o ejecutar lógica de pedidos. Si la inserción duradera falla, se responde `5xx` para que el proveedor reintente. Una entrega duplicada ya persistida responde `200` sin insertar ni aplicar de nuevo.

No se necesita introducir Redis para esta fase: un inbox PostgreSQL reclamable por worker y con reintentos es consistente con la arquitectura actual. El registro conserva solo los campos necesarios, resultado de validación, número de intentos, próxima ejecución y errores sanitizados; nunca conserva el secreto ni el header `Authorization`.

Fuente oficial de ACK y reintentos: [acciones posteriores a la notificación](https://www.mercadopago.cl/developers/es/docs/checkout-api-orders/notifications).

## Deduplicación y eventos fuera de orden

La restricción única conceptual es:

```text
(provider, environment, application_id, notification_id)
```

No se deduplica solo por `data.id`, porque una order legítimamente recibe múltiples cambios. Tampoco se usa `X-Request-Id` como ID de negocio.

El worker procesa así:

1. reclama una fila del inbox sin permitir dos workers simultáneos;
2. llama `GET https://api.mercadopago.com/v1/orders/{data.id}` con el Access Token de servidor;
3. valida `id`, `external_reference`, aplicación/vendedor, ambiente, importe y moneda contra la intención local;
4. bloquea la intención/order local;
5. compara el estado autoritativo y `last_updated_date` o `version` cuando esté presente;
6. aplica solo una transición válida y monotónica; escribe estado, evento y auditoría en la misma transacción;
7. marca la notificación procesada.

Como cada evento provoca una lectura actual, una entrega antigua no hace retroceder el estado. Además se mantienen invariantes explícitas:

- `processed/accredited` es la única confirmación de pago y su efecto se ejecuta una vez;
- un pago confirmado no vuelve a pendiente por una entrega tardía;
- `refunded/refunded` no se degrada a `processed/accredited`;
- `processed/partially_refunded` no se confunde con reembolso total;
- un contracargo nunca activa fulfillment y requiere atención operativa;
- consumir o liberar una reserva es idempotente.

El endpoint autoritativo es [GET `/v1/orders/{id}`](https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-api/get-order/get). Los [estados oficiales](https://www.mercadopago.cl/developers/es/docs/checkout-api-orders/payment-management/status/order-status) determinan la proyección; el body del Webhook y la URL de retorno nunca la determinan por sí solos.

## Reintentos de conciliación

- `429`: respetar `Retry-After` en segundos y luego backoff exponencial con jitter.
- `423` o `5xx` transitorio: backoff con jitter y límite de intentos/tiempo.
- timeout de red: mantener la misma tarea; una lectura GET no necesita clave de idempotencia.
- `401`/`403`: detener ese worker, alertar configuración/credencial y no convertirlo en retry agresivo.
- `404`: reintentar de forma acotada por posible propagación; luego dejar el evento en revisión con su `x-request-id`.
- agotamiento: conservar la fila, alertar y permitir replay operacional; no descartarla.

Una reconciliación programada puede consultar por IDs pendientes y detectar Webhooks perdidos. La [búsqueda de orders](https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-api/search-order/get) exige rango de fechas y permite `external_reference`; es recuperación, no sustituto del Webhook.

## Respuestas HTTP

| Condición | Respuesta |
| --- | --- |
| Firma ausente o inválida | `401` |
| Payload malformado o no corresponde al tópico esperado | `400` |
| Evento válido nuevo, persistido | `200` |
| Evento válido duplicado | `200` |
| Inbox temporalmente no disponible | `503` |

Las respuestas son vacías y no revelan IDs internos, estado del pedido, detalles de firma ni secretos.

## Pruebas obligatorias

- vector HMAC válido y cambios de un byte en `data.id`, request ID, `ts`, `v1` y secreto;
- ausencia de cada componente firmado;
- lectura literal de `data.id` y rechazo de discrepancia query/body;
- `application_id`, `user_id` y `live_mode` incorrectos;
- notificación nueva, duplicada y dos entregas concurrentes;
- eventos de una misma order en orden inverso;
- ACK dentro de 22 segundos sin esperar el GET;
- error transitorio, `429` con `Retry-After`, agotamiento y replay operacional;
- estado acreditado con monto o `external_reference` incorrectos;
- pago acreditado una vez, reembolso total y contracargo;
- separación estricta de test/producción y de tenants.

El simulador de Webhooks del panel sirve para validar transporte y firma. La prueba E2E de negocio requiere además una compra sandbox real con cuenta compradora y credenciales de prueba, y comprobar el resultado mediante `GET /v1/orders/{id}`.
