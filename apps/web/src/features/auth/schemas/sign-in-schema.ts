import { z } from "zod";

export const signInSchema = z.object({
  audience: z.enum(["customer", "staff"]),
  email: z
    .string()
    .trim()
    .min(1, "Ingresa tu correo electrónico.")
    .email("Ingresa un correo electrónico válido."),
  password: z
    .string()
    .min(1, "Ingresa tu contraseña.")
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type SignInFormValues = z.infer<typeof signInSchema>;
