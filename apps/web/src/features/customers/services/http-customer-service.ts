import {
  customerSchema,
  staffCustomerDetailSchema,
  staffCustomerPageSchema,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  type HttpClient,
} from "@/lib/http/http-client";

import type {
  CustomerListParams,
  CustomerProfileInput,
  StaffCustomerUpdateInput,
} from "../domain";
import type {
  CustomerSelfService,
  StaffCustomerService,
} from "./customer-service";

export class HttpCustomerSelfService implements CustomerSelfService {
  constructor(private readonly client: HttpClient) {}

  getCurrent() {
    return this.client.request("/me/profile", {
      responseSchema: customerSchema,
    });
  }

  updateCurrent(input: CustomerProfileInput) {
    return this.client.request("/me/profile", {
      method: "PATCH",
      body: input,
      csrf: true,
      responseSchema: customerSchema,
    });
  }
}

export class HttpStaffCustomerService implements StaffCustomerService {
  constructor(private readonly client: HttpClient) {}

  list(params?: CustomerListParams) {
    return this.client.request("/staff/customers", {
      responseSchema: staffCustomerPageSchema,
      ...(params === undefined ? {} : { query: params }),
    });
  }

  getById(id: string) {
    return this.client.request(`/staff/customers/${encodePathSegment(id)}`, {
      responseSchema: staffCustomerDetailSchema,
    });
  }

  update(id: string, input: StaffCustomerUpdateInput) {
    return this.client.request(`/staff/customers/${encodePathSegment(id)}`, {
      method: "PATCH",
      body: input,
      csrf: true,
      responseSchema: staffCustomerDetailSchema,
    });
  }
}
