import { tenantBrand } from "@/app/config/brand";
import { delay } from "@/lib/delay";

import type { OrganizationSettings, UpdateOrganizationSettingsInput } from "../domain";
import type { SettingsService } from "./settings-service";

const initialSettings: OrganizationSettings = {
  organizationName: tenantBrand.name,
  locale: tenantBrand.locale,
  currency: tenantBrand.currency,
  timezone: tenantBrand.timezone,
  contactEmail: "contacto@chmarket.cl",
  contactPhone: "+56 9 5555 0101",
  pickupAddress: `${tenantBrand.serviceArea} (dirección demo)`,
  pickupInstructions: "Presenta la confirmación del pedido y espera la validación del personal.",
  lowStockThreshold: 8,
  packageAlertDays: 2,
  expirationWarningDays: 14,
  updatedAt: "2026-08-29T18:00:00.000Z",
};

export class MockSettingsService implements SettingsService {
  private settings: OrganizationSettings = { ...initialSettings };

  async get(): Promise<OrganizationSettings> {
    await delay(120);
    return { ...this.settings };
  }

  async update(input: UpdateOrganizationSettingsInput): Promise<OrganizationSettings> {
    await delay(220);
    this.settings = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    return { ...this.settings };
  }
}
