import {
  packageCustomerOptionPageSchema,
  staffPackagePageSchema,
  staffPackageSchema,
  type StaffPackage as WireStaffPackage,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  HttpClient,
  resolveIdempotencyKey,
  type RequestOptions,
} from "../../../lib/http/http-client";
import type {
  DeliverStaffPackageInput,
  PackageCustomerOptionListParams,
  PackageCustomerOptionPage,
  ReceiveStaffPackageInput,
  StaffPackage,
  StaffPackageListParams,
  StaffPackagePage,
  TransitionStaffPackageInput,
} from "../domain";
import type { StaffPackageService } from "./staff-package-service";

function toStaffPackage(value: WireStaffPackage): StaffPackage {
  return {
    ...value,
    events: value.events.map((event) => ({
      ...event,
      status: event.newStatus,
      createdAt: event.occurredAt,
      recordedBy: event.actor.name,
    })),
  };
}

function toStaffPackagePage(
  value: Readonly<{
    items: WireStaffPackage[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }>,
): StaffPackagePage {
  return { ...value, items: value.items.map(toStaffPackage) };
}

export class HttpStaffPackageService implements StaffPackageService {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  async list(params: StaffPackageListParams = {}): Promise<StaffPackagePage> {
    const page = await this.#client.request("/staff/packages", {
      query: params,
      responseSchema: staffPackagePageSchema,
    });
    return toStaffPackagePage(page);
  }

  async getById(id: string): Promise<StaffPackage> {
    return toStaffPackage(
      await this.#client.request(`/staff/packages/${encodePathSegment(id)}`, {
        responseSchema: staffPackageSchema,
      }),
    );
  }

  listCustomerOptions(
    params: PackageCustomerOptionListParams = {},
  ): Promise<PackageCustomerOptionPage> {
    return this.#client.request("/staff/package-customer-options", {
      query: params,
      responseSchema: packageCustomerOptionPageSchema,
    });
  }

  async receive(
    input: ReceiveStaffPackageInput,
    options?: RequestOptions,
  ): Promise<StaffPackage> {
    const { actor, ...body } = input;
    void actor;
    return toStaffPackage(
      await this.#client.request("/staff/packages", {
        method: "POST",
        body,
        csrf: true,
        idempotencyKey: resolveIdempotencyKey(options),
        responseSchema: staffPackageSchema,
      }),
    );
  }

  async transitionStatus(
    input: TransitionStaffPackageInput,
    options?: RequestOptions,
  ): Promise<StaffPackage> {
    return toStaffPackage(
      await this.#client.request(
        `/staff/packages/${encodePathSegment(input.packageId)}/transitions`,
        {
          method: "POST",
          body: {
            toStatus: input.toStatus,
            description: input.description,
            location: input.location,
          },
          csrf: true,
          idempotencyKey: resolveIdempotencyKey(options),
          responseSchema: staffPackageSchema,
        },
      ),
    );
  }

  async deliver(
    input: DeliverStaffPackageInput,
    options?: RequestOptions,
  ): Promise<StaffPackage> {
    return toStaffPackage(
      await this.#client.request(
        `/staff/packages/${encodePathSegment(input.packageId)}/delivery`,
        {
          method: "POST",
          body: {
            pickupCode: input.pickupCode,
            receivedBy: input.receivedBy,
          },
          csrf: true,
          idempotencyKey: resolveIdempotencyKey(options),
          responseSchema: staffPackageSchema,
        },
      ),
    );
  }
}
