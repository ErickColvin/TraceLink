import {
  customerPackageSchema,
  packagePageSchema,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  HttpClient,
} from "../../../lib/http/http-client";
import type {
  CurrentCustomerPackageListParams,
  CustomerPackage,
  PackagePage,
} from "../domain";
import type { PackageService } from "./package-service";

export class HttpPackageService implements PackageService {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  listCurrentCustomer(
    params: CurrentCustomerPackageListParams = {},
  ): Promise<PackagePage> {
    return this.#client.request("/me/packages", {
      query: params,
      responseSchema: packagePageSchema,
    });
  }

  getCurrentCustomerById(id: string): Promise<CustomerPackage> {
    return this.#client.request(`/me/packages/${encodePathSegment(id)}`, {
      responseSchema: customerPackageSchema,
    });
  }
}
