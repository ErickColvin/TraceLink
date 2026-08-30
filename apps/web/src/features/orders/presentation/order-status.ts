import type { BadgeTone } from "@/components/ui";
import type { OrderStatus } from "@/features/orders";

const orderStatusMeta: Record<
  OrderStatus,
  { label: string; tone: BadgeTone; description: string }
> = {
  PENDING_PAYMENT: { label: "Pago pendiente", tone: "warning", description: "Estamos esperando la confirmación del pago." },
  PAID: { label: "Pagado", tone: "info", description: "El pago fue confirmado y el pedido entrará a preparación." },
  PREPARING: { label: "En preparación", tone: "brand", description: "El equipo está preparando los productos." },
  READY: { label: "Listo para retiro", tone: "success", description: "El pedido está disponible en el punto indicado." },
  COMPLETED: { label: "Completado", tone: "neutral", description: "La entrega o retiro se completó correctamente." },
  CANCELLED: { label: "Cancelado", tone: "danger", description: "El pedido fue cancelado." },
  REFUNDED: { label: "Reembolsado", tone: "neutral", description: "El monto fue devuelto según el medio de pago." },
};

export function getOrderStatusMeta(status: OrderStatus) {
  return orderStatusMeta[status];
}

