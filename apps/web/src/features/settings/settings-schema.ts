import { z } from "zod";

export const settingsSchema = z.object({
  organizationName: z.string().trim().min(2, "Ingresa el nombre de la organización."),
  locale: z.string().trim().min(2, "Ingresa un locale válido."),
  currency: z.string().trim().length(3, "Usa un código ISO de tres letras.").transform((value) => value.toUpperCase()),
  timezone: z.string().trim().min(3, "Ingresa una zona horaria válida."),
  contactEmail: z.email("Ingresa un correo válido."),
  contactPhone: z.string().trim().min(8, "Ingresa un teléfono válido."),
  pickupAddress: z.string().trim().min(8, "Ingresa la dirección de retiro."),
  pickupInstructions: z.string().trim().min(10, "Agrega instrucciones claras de retiro.").max(500),
  lowStockThreshold: z.number().int().min(0).max(10_000),
  packageAlertDays: z.number().int().min(1).max(365),
  expirationWarningDays: z.number().int().min(1).max(365),
});

export type SettingsFormValues = z.input<typeof settingsSchema>;
