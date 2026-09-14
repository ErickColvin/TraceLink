import { z } from "zod";

export const checkoutSchema = z
  .object({
    notes: z.string().trim().max(500, "Las notas admiten hasta 500 caracteres."),
  })
  .strict();

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
