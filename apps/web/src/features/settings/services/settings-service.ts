import type { OrganizationSettings, UpdateOrganizationSettingsInput } from "../domain";

export interface SettingsService {
  get(): Promise<OrganizationSettings>;
  update(input: UpdateOrganizationSettingsInput): Promise<OrganizationSettings>;
}
