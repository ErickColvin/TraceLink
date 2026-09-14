import type { PackageStatus, PackageTransitionTarget } from "@tracelink/contracts";

const ALLOWED_TRANSITIONS = {
  EXPECTED: ["RECEIVED", "INCIDENT", "LOST"],
  RECEIVED: ["STORED", "INCIDENT", "RETURNED", "LOST"],
  STORED: ["READY_FOR_PICKUP", "INCIDENT", "RETURNED", "LOST"],
  READY_FOR_PICKUP: ["INCIDENT", "RETURNED", "LOST"],
  INCIDENT: ["STORED", "RETURNED", "LOST"],
  PICKED_UP: [],
  RETURNED: [],
  LOST: [],
} as const satisfies Readonly<
  Record<PackageStatus, readonly PackageTransitionTarget[]>
>;

export function canTransitionPackage(
  fromStatus: PackageStatus,
  toStatus: PackageTransitionTarget,
): boolean {
  return (ALLOWED_TRANSITIONS[fromStatus] as readonly PackageTransitionTarget[])
    .includes(toStatus);
}

export function packageTransitionDescription(status: PackageStatus): string {
  return {
    EXPECTED: "Paquete esperado.",
    RECEIVED: "Paquete recibido en CH Market.",
    STORED: "Paquete almacenado.",
    READY_FOR_PICKUP: "Paquete listo para retiro.",
    PICKED_UP: "Paquete entregado al receptor autorizado.",
    RETURNED: "Paquete devuelto.",
    LOST: "Paquete marcado como extraviado.",
    INCIDENT: "Incidente registrado para el paquete.",
  }[status];
}
