import type {
  CurrentCustomerPackageListParams,
  CustomerPackage,
  DeliverPackageRequest,
  PackageCustomerOptionPage,
  PackagePage,
  ReceivePackageRequest,
  StaffPackage,
  StaffPackageListParams,
  StaffPackagePage,
  TransitionPackageRequest,
} from "@tracelink/contracts";
import { staffPackageSchema } from "@tracelink/contracts";

import type { PostgresDatabase } from "../../database/index.js";
import {
  IdempotencyService,
  type IdempotencyExecution,
} from "../../shared/idempotency/idempotency.js";
import {
  PostgresPackageRepository,
  type PackageCustomerOptionListParams,
} from "./package-repository.js";

export class PackageService {
  readonly #repository: PostgresPackageRepository;
  readonly #idempotency: IdempotencyService;

  constructor(options: Readonly<{
    database: PostgresDatabase;
    idempotencySecret: string;
    pickupCodeSecret: string;
  }>) {
    this.#repository = new PostgresPackageRepository(
      options.database,
      options.pickupCodeSecret,
    );
    this.#idempotency = new IdempotencyService(
      options.database,
      options.idempotencySecret,
    );
  }

  listCurrentCustomer(
    organizationId: string,
    customerId: string,
    params: CurrentCustomerPackageListParams,
  ): Promise<PackagePage> {
    return this.#repository.listCurrentCustomer(
      organizationId,
      customerId,
      params,
    );
  }

  getCurrentCustomerById(
    organizationId: string,
    customerId: string,
    packageId: string,
  ): Promise<CustomerPackage> {
    return this.#repository.getCurrentCustomerById(
      organizationId,
      customerId,
      packageId,
    );
  }

  listStaff(
    organizationId: string,
    params: StaffPackageListParams,
  ): Promise<StaffPackagePage> {
    return this.#repository.listStaff(organizationId, params);
  }

  getStaffById(
    organizationId: string,
    packageId: string,
  ): Promise<StaffPackage> {
    return this.#repository.getStaffById(organizationId, packageId);
  }

  listCustomerOptions(
    organizationId: string,
    params: PackageCustomerOptionListParams,
  ): Promise<PackageCustomerOptionPage> {
    return this.#repository.listCustomerOptions(organizationId, params);
  }

  receive(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    input: ReceivePackageRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<IdempotencyExecution<StaffPackage>> {
    return this.#idempotency.execute({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      key: options.idempotencyKey,
      operation: "package.receive",
      payload: options.input,
      requestId: options.requestId,
      responseSchema: staffPackageSchema,
      mutation: async (executor) => {
        const body = await this.#repository.receive(executor, options);
        return {
          statusCode: 201,
          body,
          resourceType: "Package",
          resourceId: body.id,
        };
      },
    });
  }

  transition(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    packageId: string;
    input: TransitionPackageRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<IdempotencyExecution<StaffPackage>> {
    return this.#idempotency.execute({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      key: options.idempotencyKey,
      operation: "package.transition",
      payload: { packageId: options.packageId, ...options.input },
      requestId: options.requestId,
      responseSchema: staffPackageSchema,
      mutation: async (executor) => {
        const body = await this.#repository.transition(executor, options);
        return {
          statusCode: 200,
          body,
          resourceType: "Package",
          resourceId: body.id,
        };
      },
    });
  }

  deliver(options: Readonly<{
    organizationId: string;
    actorUserId: string;
    packageId: string;
    input: DeliverPackageRequest;
    requestId: string;
    idempotencyKey: string;
  }>): Promise<IdempotencyExecution<StaffPackage>> {
    return this.#idempotency.execute({
      organizationId: options.organizationId,
      actorUserId: options.actorUserId,
      key: options.idempotencyKey,
      operation: "package.deliver",
      payload: { packageId: options.packageId, ...options.input },
      requestId: options.requestId,
      responseSchema: staffPackageSchema,
      mutation: async (executor) => {
        const body = await this.#repository.deliver(executor, options);
        return {
          statusCode: 200,
          body,
          resourceType: "Package",
          resourceId: body.id,
        };
      },
    });
  }
}
