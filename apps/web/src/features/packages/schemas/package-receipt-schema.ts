import { z } from "zod";

function isValidDateTime(value: string): boolean {
  return value.length === 0 || !Number.isNaN(new Date(value).getTime());
}

export const packageReceiptSchema = z.object({
  customerId: z.string().min(1, "Selecciona un cliente."),
  trackingCode: z
    .string()
    .trim()
    .min(5, "El código debe tener al menos 5 caracteres.")
    .max(30, "El código no puede superar 30 caracteres.")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Usa solamente letras, números y guiones.",
    ),
  carrier: z
    .string()
    .trim()
    .min(2, "Indica el transportista.")
    .max(80, "El transportista no puede superar 80 caracteres."),
  orderId: z.string().trim().max(80, "El pedido asociado es demasiado largo."),
  contentsDescription: z
    .string()
    .trim()
    .min(3, "Describe brevemente el contenido.")
    .max(180, "La descripción no puede superar 180 caracteres."),
  itemCount: z
    .number({ error: "Ingresa una cantidad válida." })
    .int("La cantidad debe ser un entero.")
    .min(1, "Debe existir al menos un artículo."),
  requiresColdStorage: z.boolean(),
  storageLocation: z
    .string()
    .trim()
    .min(2, "Indica la ubicación inicial del paquete.")
    .max(100, "La ubicación no puede superar 100 caracteres."),
  notes: z
    .string()
    .trim()
    .max(500, "Las notas no pueden superar 500 caracteres."),
  expectedAt: z
    .string()
    .refine(isValidDateTime, "La fecha esperada no es válida."),
  receivedAt: z
    .string()
    .min(1, "Indica la fecha de recepción.")
    .refine(isValidDateTime, "La fecha de recepción no es válida."),
  weightKg: z
    .number({ error: "Ingresa un peso válido." })
    .positive("El peso debe ser mayor que cero.")
    .max(1_000, "El peso supera el máximo admitido.")
    .optional(),
});

export type PackageReceiptValues = z.infer<typeof packageReceiptSchema>;
