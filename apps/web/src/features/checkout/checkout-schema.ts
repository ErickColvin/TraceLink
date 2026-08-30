import { z } from "zod";

export const checkoutSchema = z
  .object({
    firstName: z.string().trim().min(2, "Ingresa tu nombre."),
    lastName: z.string().trim().min(2, "Ingresa tu apellido."),
    email: z.email("Ingresa un correo válido."),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{8,16}$/, "Ingresa un teléfono válido."),
    deliveryMethod: z.enum(["PICKUP", "DELIVERY"]),
    line1: z.string().trim(),
    commune: z.string().trim(),
    city: z.string().trim(),
    region: z.string().trim(),
    notes: z.string().trim().max(500, "Las notas admiten hasta 500 caracteres."),
  })
  .superRefine((values, context) => {
    if (values.deliveryMethod !== "DELIVERY") return;

    const requiredAddressFields = [
      ["line1", values.line1, "Ingresa la dirección de entrega."],
      ["commune", values.commune, "Ingresa la comuna."],
      ["city", values.city, "Ingresa la ciudad."],
      ["region", values.region, "Ingresa la región."],
    ] as const;

    requiredAddressFields.forEach(([path, value, message]) => {
      if (!value) {
        context.addIssue({ code: "custom", path: [path], message });
      }
    });
  });

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
