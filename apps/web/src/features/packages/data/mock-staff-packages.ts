import type {
  StaffPackage,
  StaffPackageCustomer,
} from "../domain";
import { mockPackages } from "./mock-packages";

const packageCarrierById: Readonly<Record<string, string>> = {
  "package-ch-41028": "Blue Express",
  "package-ch-40991": "Chilexpress",
  "package-ch-39744": "Starken",
  "package-ch-38107": "Blue Express",
  "package-ch-41052": "CH Market",
};

export const mockStaffPackageCustomers: Readonly<
  Record<string, StaffPackageCustomer>
> = {
  "customer-valentina-rojas": {
    id: "customer-valentina-rojas",
    fullName: "Valentina Rojas",
    email: "valentina.rojas@example.cl",
    phone: "+56 9 6123 4587",
  },
  "customer-matias-soto": {
    id: "customer-matias-soto",
    fullName: "Matías Soto",
    email: "matias.soto@example.cl",
    phone: "+56 9 7318 2044",
  },
  "customer-camila-fernandez": {
    id: "customer-camila-fernandez",
    fullName: "Camila Fernández",
    email: "camila.fernandez@example.cl",
    phone: "+56 9 8455 9210",
  },
  "customer-diego-munoz": {
    id: "customer-diego-munoz",
    fullName: "Diego Muñoz",
    email: "diego.munoz@example.cl",
    phone: "+56 9 5570 1193",
  },
  "customer-isidora-perez": {
    id: "customer-isidora-perez",
    fullName: "Isidora Pérez",
    email: "isidora.perez@example.cl",
    phone: "+56 9 4008 7741",
  },
};

export const mockStaffPackages = mockPackages.map((customerPackage) => {
  const customer = mockStaffPackageCustomers[customerPackage.customerId];

  if (!customer) {
    throw new Error(
      `Falta el cliente operativo del paquete '${customerPackage.id}'.`,
    );
  }

  return {
    ...customerPackage,
    carrier: packageCarrierById[customerPackage.id] ?? "CH Market",
    notes:
      customerPackage.status === "INCIDENT"
        ? "Retener hasta completar la inspección del embalaje."
        : undefined,
    contents: { ...customerPackage.contents },
    events: customerPackage.events.map((event, index, events) => ({
      ...event,
      previousStatus: index === 0 ? null : (events[index - 1]?.status ?? null),
      newStatus: event.status,
      createdAt: event.occurredAt,
      actor: {
        id: "staff-seed",
        name:
          "recordedBy" in event && event.recordedBy
            ? event.recordedBy
            : "Sistema TraceLink",
      },
      notes: event.description,
    })),
    customer: { ...customer },
    pickupReceipt:
      customerPackage.status === "PICKED_UP"
        ? {
            receivedBy: customer.fullName,
            pickupCodeVerified: true,
            deliveredAt: customerPackage.updatedAt,
            deliveredBy: "Equipo de atención",
          }
        : undefined,
  } satisfies StaffPackage;
}) satisfies StaffPackage[];
