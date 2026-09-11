import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components";
import { Card, CardContent, buttonStyles } from "@/components/ui";

const STATUS_COPY = {
  approved: {
    icon: CheckCircle2,
    title: "Pago recibido",
    description: "Estamos preparando tu pedido para retiro. El estado autoritativo esta en Mis pedidos.",
  },
  pending: {
    icon: Clock3,
    title: "Pago pendiente",
    description: "El proveedor aun esta procesando el pago. Revisaremos el resultado por webhook y conciliacion.",
  },
  rejected: {
    icon: AlertTriangle,
    title: "Pago no aprobado",
    description: "Puedes volver a Mis pedidos y generar un nuevo intento si la reserva sigue disponible.",
  },
} as const;

export function CheckoutResultPage() {
  const [params] = useSearchParams();
  const status = params.get("status");
  const copy =
    status === "approved" || status === "rejected"
      ? STATUS_COPY[status]
      : STATUS_COPY.pending;
  const Icon = copy.icon;

  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <PageHeader
          eyebrow="Resultado de pago"
          title={copy.title}
          description="Esta pantalla solo muestra el retorno del proveedor; TraceLink valida el pago desde el backend."
        />
        <Card className="mt-8">
          <CardContent className="py-9 text-center sm:py-12">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-100 text-brand-800">
              <Icon aria-hidden="true" className="size-8" />
            </span>
            <p className="mx-auto mt-5 max-w-xl leading-7 text-ink-600">
              {copy.description}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/mi-cuenta/pedidos" className={buttonStyles()}>
                Ver mis pedidos
              </Link>
              <Link to="/productos" className={buttonStyles({ variant: "outline" })}>
                Seguir comprando
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
