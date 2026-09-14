import { z } from "zod";

const baseOrderSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  orderNumber: z.string().trim().min(1).max(80),
});

const eventPayloadSchemas = {
  "user.welcome": z.object({
    firstName: z.string().trim().min(1).max(100),
  }),
  "order.created": baseOrderSchema.extend({
    total: z.number().int().nonnegative(),
  }),
  "order.payment.approved": baseOrderSchema.extend({
    total: z.number().int().nonnegative(),
  }),
  "order.ready": baseOrderSchema.extend({
    pickupAddress: z.string().trim().min(1).max(500).optional(),
  }),
  "order.cancelled": baseOrderSchema,
  "order.refunded": baseOrderSchema.extend({
    total: z.number().int().nonnegative(),
  }),
} as const;

export type NotificationEventType = keyof typeof eventPayloadSchemas;

export const NOTIFICATION_EVENT_TYPES = Object.freeze(
  Object.keys(eventPayloadSchemas) as NotificationEventType[],
);

export function isNotificationEventType(value: string): value is NotificationEventType {
  return Object.hasOwn(eventPayloadSchemas, value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function renderNotification(
  eventType: NotificationEventType,
  rawPayload: unknown,
): Readonly<{ subject: string; text: string; html: string }> {
  let subject: string;
  let message: string;

  switch (eventType) {
    case "user.welcome": {
      const payload = eventPayloadSchemas[eventType].parse(rawPayload);
      subject = "Bienvenido a CH Market";
      message = `Hola ${payload.firstName}, tu cuenta fue creada correctamente.`;
      break;
    }
    case "order.created": {
      const payload = eventPayloadSchemas[eventType].parse(rawPayload);
      subject = `Recibimos tu pedido ${payload.orderNumber}`;
      message = `Hola ${payload.firstName}, recibimos tu pedido ${payload.orderNumber} por ${formatClp(payload.total)}. Te avisaremos cuando cambie su estado.`;
      break;
    }
    case "order.payment.approved": {
      const payload = eventPayloadSchemas[eventType].parse(rawPayload);
      subject = `Pago aprobado para ${payload.orderNumber}`;
      message = `Hola ${payload.firstName}, confirmamos el pago de ${formatClp(payload.total)} para tu pedido ${payload.orderNumber}.`;
      break;
    }
    case "order.ready": {
      const payload = eventPayloadSchemas[eventType].parse(rawPayload);
      subject = `Tu pedido ${payload.orderNumber} está listo`;
      message = `Hola ${payload.firstName}, tu pedido ${payload.orderNumber} está listo para retiro${payload.pickupAddress === undefined ? "." : ` en ${payload.pickupAddress}.`}`;
      break;
    }
    case "order.cancelled": {
      const payload = eventPayloadSchemas[eventType].parse(rawPayload);
      subject = `Pedido ${payload.orderNumber} cancelado`;
      message = `Hola ${payload.firstName}, tu pedido ${payload.orderNumber} fue cancelado.`;
      break;
    }
    case "order.refunded": {
      const payload = eventPayloadSchemas[eventType].parse(rawPayload);
      subject = `Reembolso procesado para ${payload.orderNumber}`;
      message = `Hola ${payload.firstName}, procesamos el reembolso de ${formatClp(payload.total)} para tu pedido ${payload.orderNumber}.`;
      break;
    }
  }

  return {
    subject,
    text: message,
    html: `<p>${escapeHtml(message)}</p><p>CH Market</p>`,
  };
}
