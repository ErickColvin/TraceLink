import type { BadgeTone } from "@/components/ui";
import type { PackageStatus } from "@/features/packages";

const packageStatusMeta: Record<
  PackageStatus,
  { label: string; shortLabel: string; tone: BadgeTone; description: string }
> = {
  EXPECTED: { label: "Paquete esperado", shortLabel: "Esperado", tone: "info", description: "El paquete fue anunciado y esperamos su llegada." },
  RECEIVED: { label: "Paquete recibido", shortLabel: "Recibido", tone: "brand", description: "La recepción fue registrada correctamente." },
  STORED: { label: "Almacenado", shortLabel: "Almacenado", tone: "brand", description: "El paquete está resguardado en una ubicación asignada." },
  READY_FOR_PICKUP: { label: "Listo para retiro", shortLabel: "Listo", tone: "success", description: "El paquete puede retirarse en el punto indicado." },
  PICKED_UP: { label: "Retirado", shortLabel: "Retirado", tone: "neutral", description: "El retiro se completó y quedó registrado." },
  RETURNED: { label: "Devuelto", shortLabel: "Devuelto", tone: "warning", description: "El paquete ingresó a un flujo de devolución." },
  LOST: { label: "No localizado", shortLabel: "No localizado", tone: "danger", description: "Existe una incidencia de localización en revisión." },
  INCIDENT: { label: "Incidencia", shortLabel: "Incidencia", tone: "danger", description: "El paquete requiere revisión del equipo." },
};

export function getPackageStatusMeta(status: PackageStatus) {
  return packageStatusMeta[status];
}

