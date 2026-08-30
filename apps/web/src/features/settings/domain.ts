export type OrganizationSettings = {
  organizationName: string;
  locale: string;
  currency: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  pickupAddress: string;
  pickupInstructions: string;
  lowStockThreshold: number;
  expirationWarningDays: number;
  updatedAt: string;
};

export type UpdateOrganizationSettingsInput = Omit<OrganizationSettings, "updatedAt">;
