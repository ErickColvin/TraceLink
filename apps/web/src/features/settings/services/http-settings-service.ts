import { organizationSettingsSchema } from "@tracelink/contracts";

import type { HttpClient } from "@/lib/http/http-client";

import type { UpdateOrganizationSettingsInput } from "../domain";
import type { SettingsService } from "./settings-service";

export class HttpSettingsService implements SettingsService {
  constructor(private readonly client: HttpClient) {}

  get() {
    return this.client.request("/staff/settings", {
      responseSchema: organizationSettingsSchema,
    });
  }

  update(input: UpdateOrganizationSettingsInput) {
    return this.client.request("/staff/settings", {
      method: "PUT",
      body: input,
      csrf: true,
      responseSchema: organizationSettingsSchema,
    });
  }
}
