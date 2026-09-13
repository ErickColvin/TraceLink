import { delay } from "@/lib/delay";

import {
  mockStaffPackageCustomers,
  mockStaffPackages,
} from "../data/mock-staff-packages";
import type {
  DeliverStaffPackageInput,
  PackageCustomerOptionListParams,
  PackageCustomerOptionPage,
  PackageStatus,
  ReceiveStaffPackageInput,
  StaffPackage,
  StaffPackageCustomer,
  StaffPackageListParams,
  StaffPackagePage,
  StaffPackageSort,
  StaffTrackingEvent,
  TransitionStaffPackageInput,
} from "../domain";
import {
  canTransitionPackage,
  isPackageExceptionStatus,
} from "../workflow/package-workflow";
import {
  DuplicateTrackingCodeError,
  InvalidPackageDeliveryError,
  InvalidPackageTransitionError,
  StaffPackageCustomerNotFoundError,
  StaffPackageNotFoundError,
  type StaffPackageService,
} from "./staff-package-service";

const DEFAULT_PAGE_SIZE = 10;

const queuePriority: Readonly<Record<PackageStatus, number>> = {
  EXPECTED: 0,
  RECEIVED: 1,
  INCIDENT: 2,
  STORED: 3,
  READY_FOR_PICKUP: 4,
  LOST: 5,
  RETURNED: 6,
  PICKED_UP: 7,
};

const standardEventDescriptions: Readonly<Partial<Record<PackageStatus, string>>> = {
  RECEIVED: "Recepción confirmada y paquete incorporado a la operación.",
  STORED: "Paquete almacenado en la ubicación registrada.",
  READY_FOR_PICKUP: "Paquete preparado y disponible para retiro.",
};

export type MockStaffPackageServiceOptions = Readonly<{
  seed?: readonly StaffPackage[];
  customers?: Readonly<Record<string, StaffPackageCustomer>>;
  latencyMs?: number;
  now?: () => Date;
}>;

function cloneStaffPackage(customerPackage: StaffPackage): StaffPackage {
  return {
    ...customerPackage,
    contents: { ...customerPackage.contents },
    customer: { ...customerPackage.customer },
    pickupReceipt: customerPackage.pickupReceipt
      ? { ...customerPackage.pickupReceipt }
      : undefined,
    events: customerPackage.events.map((event) => ({
      ...event,
      actor: { ...event.actor },
    })),
  };
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-CL");
}

function sortStaffPackages(
  packages: StaffPackage[],
  sort: StaffPackageSort,
): StaffPackage[] {
  return packages.sort((left, right) => {
    switch (sort) {
      case "QUEUE": {
        const difference = queuePriority[left.status] - queuePriority[right.status];
        return difference !== 0
          ? difference
          : Date.parse(left.createdAt) - Date.parse(right.createdAt);
      }
      case "NEWEST":
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      case "OLDEST":
        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      case "STATUS":
        return left.status.localeCompare(right.status);
    }
  });
}

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidPackageTransitionError("La fecha de recepción no es válida.");
  }
  return parsed;
}

export class MockStaffPackageService implements StaffPackageService {
  private packages: StaffPackage[];
  private readonly customers: Readonly<Record<string, StaffPackageCustomer>>;
  private readonly latencyMs: number;
  private readonly now: () => Date;

  constructor(options: MockStaffPackageServiceOptions = {}) {
    this.packages = (options.seed ?? mockStaffPackages).map(cloneStaffPackage);
    this.customers = options.customers ?? mockStaffPackageCustomers;
    this.latencyMs = Math.max(0, options.latencyMs ?? 120);
    this.now = options.now ?? (() => new Date());
  }

  async list(params: StaffPackageListParams = {}): Promise<StaffPackagePage> {
    await delay(this.latencyMs);
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const search = normalizeSearch(params.search ?? "");
    const tracking = normalizeSearch(params.tracking ?? "");
    const customer = normalizeSearch(params.customer ?? "");
    const carrier = normalizeSearch(params.carrier ?? "");
    const location = normalizeSearch(params.location ?? "");
    const statuses = params.statuses ? new Set(params.statuses) : undefined;
    const filtered = this.packages
      .filter((customerPackage) => {
        if (!search) return true;
        return normalizeSearch(
          [
            customerPackage.trackingCode,
            customerPackage.carrier,
            customerPackage.orderId ?? "",
            customerPackage.customer.fullName,
            customerPackage.customer.email,
            customerPackage.contents.description,
            customerPackage.storageLocation ?? "",
          ].join(" "),
        ).includes(search);
      })
      .filter(
        (customerPackage) =>
          !tracking ||
          normalizeSearch(customerPackage.trackingCode).includes(tracking),
      )
      .filter(
        (customerPackage) =>
          !customer ||
          normalizeSearch(
            `${customerPackage.customer.fullName} ${customerPackage.customer.email}`,
          ).includes(customer),
      )
      .filter(
        (customerPackage) =>
          !carrier || normalizeSearch(customerPackage.carrier).includes(carrier),
      )
      .filter(
        (customerPackage) =>
          !location ||
          normalizeSearch(customerPackage.storageLocation ?? "").includes(location),
      )
      .filter(
        (customerPackage) =>
          !statuses || statuses.has(customerPackage.status),
      )
      .filter(
        (customerPackage) =>
          params.coldStorage === undefined ||
          customerPackage.contents.requiresColdStorage === params.coldStorage,
      )
      .map(cloneStaffPackage);
    const sorted = sortStaffPackages(filtered, params.sort ?? "QUEUE");
    const totalItems = sorted.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: sorted.slice(start, start + pageSize),
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async getById(id: string): Promise<StaffPackage> {
    await delay(this.latencyMs);
    const customerPackage = this.packages.find((candidate) => candidate.id === id);
    if (!customerPackage) throw new StaffPackageNotFoundError(id);
    return cloneStaffPackage(customerPackage);
  }

  async listCustomerOptions(
    params: PackageCustomerOptionListParams = {},
  ): Promise<PackageCustomerOptionPage> {
    await delay(this.latencyMs);
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const pageSize = Math.max(1, Math.trunc(params.pageSize ?? DEFAULT_PAGE_SIZE));
    const search = normalizeSearch(params.search ?? "");
    const items = Object.values(this.customers)
      .filter((customer) =>
        normalizeSearch(`${customer.fullName} ${customer.email}`).includes(search),
      )
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "es-CL"))
      .map((customer) => ({
        id: customer.id,
        displayName: customer.fullName,
        email: customer.email,
      }));
    const totalItems = items.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async receive(input: ReceiveStaffPackageInput): Promise<StaffPackage> {
    await delay(this.latencyMs);
    const trackingCode = input.trackingCode.trim().toLocaleUpperCase("es-CL");
    if (!trackingCode) {
      throw new InvalidPackageTransitionError("Ingresa un código de seguimiento.");
    }
    if (
      this.packages.some(
        (candidate) =>
          candidate.trackingCode.toLocaleUpperCase("es-CL") === trackingCode,
      )
    ) {
      throw new DuplicateTrackingCodeError(trackingCode);
    }

    const customer = this.customers[input.customerId];
    if (!customer) throw new StaffPackageCustomerNotFoundError(input.customerId);
    const carrier = input.carrier.trim();
    const storageLocation = input.storageLocation.trim();
    if (carrier.length < 2 || storageLocation.length < 2) {
      throw new InvalidPackageTransitionError(
        "Transportista y ubicación son obligatorios para recibir el paquete.",
      );
    }
    const description = input.contents.description.trim();
    if (description.length < 3 || input.contents.itemCount < 1) {
      throw new InvalidPackageTransitionError(
        "El contenido y la cantidad del paquete son obligatorios.",
      );
    }

    const operationDate = this.now();
    const receivedDate = parseDate(input.receivedAt, operationDate);
    const receivedAt = receivedDate.toISOString();
    const createdAt = new Date(
      Math.min(operationDate.getTime(), receivedDate.getTime()),
    ).toISOString();
    const id = `package-staff-${this.packages.length + 1}-${trackingCode
      .toLocaleLowerCase("es-CL")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;
    const events: StaffTrackingEvent[] = [
      {
        id: `${id}-event-1`,
        status: "EXPECTED",
        occurredAt: createdAt,
        description: "Paquete anunciado para recepción operativa.",
        recordedBy: input.actor.name,
        previousStatus: null,
        newStatus: "EXPECTED",
        createdAt,
        actor: { ...input.actor },
        notes: input.notes?.trim() || undefined,
      },
      {
        id: `${id}-event-2`,
        status: "RECEIVED",
        occurredAt: receivedAt,
        description: "Recepción registrada y contenido declarado.",
        location: "Muelle de recepción",
        recordedBy: input.actor.name,
        previousStatus: "EXPECTED",
        newStatus: "RECEIVED",
        createdAt: receivedAt,
        actor: { ...input.actor },
        notes: input.notes?.trim() || undefined,
      },
    ];
    const customerPackage: StaffPackage = {
      id,
      trackingCode,
      carrier,
      customerId: customer.id,
      orderId: input.orderId?.trim() || undefined,
      status: "RECEIVED",
      contents: {
        description,
        itemCount: Math.trunc(input.contents.itemCount),
        requiresColdStorage: input.contents.requiresColdStorage,
      },
      expectedAt: input.expectedAt,
      receivedAt,
      storageLocation,
      notes: input.notes?.trim() || undefined,
      weightKg: input.weightKg,
      createdAt,
      updatedAt: receivedAt,
      events,
      customer: { ...customer },
    };
    this.packages = [customerPackage, ...this.packages];
    return cloneStaffPackage(customerPackage);
  }

  async transitionStatus(
    input: TransitionStaffPackageInput,
  ): Promise<StaffPackage> {
    await delay(this.latencyMs);
    const index = this.packages.findIndex(
      (candidate) => candidate.id === input.packageId,
    );
    const current = this.packages[index];
    if (!current) throw new StaffPackageNotFoundError(input.packageId);
    if (input.toStatus === "PICKED_UP") {
      throw new InvalidPackageTransitionError(
        "La entrega requiere código de retiro y nombre de quien recibe.",
      );
    }
    if (!canTransitionPackage(current.status, input.toStatus)) {
      throw new InvalidPackageTransitionError(
        `No se puede cambiar un paquete de ${current.status} a ${input.toStatus}.`,
      );
    }

    const description = input.description?.trim();
    if (isPackageExceptionStatus(input.toStatus) && (!description || description.length < 5)) {
      throw new InvalidPackageTransitionError(
        "Describe la excepción con al menos 5 caracteres.",
      );
    }
    const location = input.location?.trim();
    if (input.toStatus === "STORED" && !location) {
      throw new InvalidPackageTransitionError(
        "La ubicación es obligatoria para almacenar el paquete.",
      );
    }

    const occurredAt = this.now().toISOString();
    const event: StaffTrackingEvent = {
      id: `${current.id}-event-${current.events.length + 1}`,
      status: input.toStatus,
      occurredAt,
      description:
        description ??
        standardEventDescriptions[input.toStatus] ??
        "Estado operativo actualizado.",
      location: location || current.storageLocation,
      recordedBy: input.actor.name,
      previousStatus: current.status,
      newStatus: input.toStatus,
      createdAt: occurredAt,
      actor: { ...input.actor },
      notes: description,
    };
    const next: StaffPackage = {
      ...cloneStaffPackage(current),
      status: input.toStatus,
      receivedAt:
        input.toStatus === "RECEIVED" ? occurredAt : current.receivedAt,
      storageLocation:
        input.toStatus === "STORED" ? location : current.storageLocation,
      pickupDeadline:
        input.toStatus === "READY_FOR_PICKUP"
          ? new Date(this.now().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
          : current.pickupDeadline,
      updatedAt: occurredAt,
      events: [
        ...current.events.map((item) => ({
          ...item,
          actor: { ...item.actor },
        })),
        event,
      ],
    };
    this.packages[index] = next;
    return cloneStaffPackage(next);
  }

  async deliver(input: DeliverStaffPackageInput): Promise<StaffPackage> {
    await delay(this.latencyMs);
    const index = this.packages.findIndex(
      (candidate) => candidate.id === input.packageId,
    );
    const current = this.packages[index];
    if (!current) throw new StaffPackageNotFoundError(input.packageId);
    if (current.status !== "READY_FOR_PICKUP") {
      throw new InvalidPackageDeliveryError(
        "Solo se puede entregar un paquete listo para retiro.",
      );
    }

    const pickupCode = input.pickupCode.trim();
    const receivedBy = input.receivedBy.trim();
    if (pickupCode.length < 4) {
      throw new InvalidPackageDeliveryError(
        "Ingresa un código de retiro de al menos 4 caracteres.",
      );
    }
    if (receivedBy.length < 3) {
      throw new InvalidPackageDeliveryError(
        "Ingresa el nombre de quien recibe.",
      );
    }

    const deliveredAt = this.now().toISOString();
    const next: StaffPackage = {
      ...cloneStaffPackage(current),
      status: "PICKED_UP",
      updatedAt: deliveredAt,
      pickupReceipt: {
        receivedBy,
        pickupCodeVerified: true,
        deliveredAt,
        deliveredBy: input.actor.name,
      },
      events: [
        ...current.events.map((event) => ({
          ...event,
          actor: { ...event.actor },
        })),
        {
          id: `${current.id}-event-${current.events.length + 1}`,
          status: "PICKED_UP",
          occurredAt: deliveredAt,
          description: `Entrega confirmada a ${receivedBy}.`,
          location: "Mesón de retiro",
          recordedBy: input.actor.name,
          previousStatus: current.status,
          newStatus: "PICKED_UP",
          createdAt: deliveredAt,
          actor: { ...input.actor },
          notes: `Entrega confirmada a ${receivedBy}.`,
        },
      ],
    };
    this.packages[index] = next;
    return cloneStaffPackage(next);
  }
}
