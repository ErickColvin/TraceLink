import { staffRoleDefinitionSchema } from "@tracelink/contracts";

import {
  encodePathSegment,
  type HttpClient,
} from "@/lib/http/http-client";

import type { UpdateRolePermissionsInput } from "../domain";
import type { RoleService } from "./role-service";

const staffRoleListSchema = staffRoleDefinitionSchema.array();

export class HttpRoleService implements RoleService {
  constructor(private readonly client: HttpClient) {}

  list() {
    return this.client.request("/staff/roles", {
      responseSchema: staffRoleListSchema,
    });
  }

  getById(id: string) {
    return this.client.request(`/staff/roles/${encodePathSegment(id)}`, {
      responseSchema: staffRoleDefinitionSchema,
    });
  }

  updatePermissions(input: UpdateRolePermissionsInput) {
    const { id, ...body } = input;

    return this.client.request(
      `/staff/roles/${encodePathSegment(id)}/permissions`,
      {
        method: "PUT",
        body,
        csrf: true,
        responseSchema: staffRoleDefinitionSchema,
      },
    );
  }
}
