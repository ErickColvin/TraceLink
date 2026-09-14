import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "Ingresa un nombre de al menos 2 caracteres.")
      .max(80, "El nombre admite hasta 80 caracteres."),
    lastName: z
      .string()
      .trim()
      .min(2, "Ingresa un apellido de al menos 2 caracteres.")
      .max(80, "El apellido admite hasta 80 caracteres."),
    email: z
      .string()
      .trim()
      .min(1, "Ingresa tu correo electrónico.")
      .email("Ingresa un correo electrónico válido.")
      .max(254, "El correo admite hasta 254 caracteres."),
    phone: z
      .string()
      .trim()
      .max(32, "El teléfono admite hasta 32 caracteres.")
      .refine(
        (value) => value.length === 0 || value.length >= 6,
        "Ingresa un teléfono de al menos 6 caracteres.",
      ),
    password: z
      .string()
      .min(12, "La contraseña debe tener al menos 12 caracteres.")
      .max(128, "La contraseña admite hasta 128 caracteres."),
    confirmPassword: z
      .string()
      .min(1, "Confirma tu contraseña.")
      .max(128, "La contraseña admite hasta 128 caracteres."),
  })
  .superRefine((values, context) => {
    if (values.password !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden.",
      });
    }
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
