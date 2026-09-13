import {
  staffUserPageSchema,
  staffUserSchema,
} from "@tracelink/contracts";

import {
  encodePathSegment,
  type HttpClient,
} from "@/lib/http/http-client";

import type { StaffUserListParams, UpdateStaffUserInput } from "../domain";
import type { UserService } from "./user-service";

export class HttpUserService implements UserService {
  constructor(private readonly client: HttpClient) {}

  list(params?: StaffUserListParams) {
    return this.client.request("/staff/users", {
      responseSchema: staffUserPageSchema,
      ...(params === undefined ? {} : { query: params }),
    });
  }

  getById(id: string) {
    return this.client.request(`/staff/users/${encodePathSegment(id)}`, {
      responseSchema: staffUserSchema,
    });
  }

  update(input: UpdateStaffUserInput) {
    const { id, ...body } = input;

    return this.client.request(
      `/staff/users/${encodePathSegment(id)}/access`,
      {
        method: "PATCH",
        body,
        csrf: true,
        responseSchema: staffUserSchema,
      },
    );
  }
}
