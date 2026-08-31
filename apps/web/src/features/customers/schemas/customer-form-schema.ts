import { z } from "zod";

import type {
  Customer,
  CustomerProfileInput,
  StaffCustomerUpdateInput,
} from "../domain";

const optionalAddressField = z.string().trim().max(120);

export const customerFormSchema = z
  .object({
    firstName: z.string().trim().min(2, "Ingresa el nombre.").max(80),
    lastName: z.string().trim().min(2, "Ingresa el apellido.").max(80),
    email: z.email("Ingresa un correo electrónico válido."),
    phone: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(
          /^\+?[0-9][0-9 ()-]{7,20}$/,
          "Ingresa un teléfono válido.",
        ),
    ]),
    addressLine1: optionalAddressField,
    addressLine2: optionalAddressField,
    commune: optionalAddressField,
    city: optionalAddressField,
    region: optionalAddressField,
    status: z.enum(["ACTIVE", "INACTIVE"]),
  })
  .superRefine((values, context) => {
    const hasAddress = Boolean(
      values.addressLine1 ||
        values.addressLine2 ||
        values.commune ||
        values.city ||
        values.region,
    );
    if (!hasAddress) return;

    const requiredAddressFields = [
      ["addressLine1", values.addressLine1, "Ingresa la dirección."],
      ["commune", values.commune, "Ingresa la comuna."],
      ["city", values.city, "Ingresa la ciudad."],
      ["region", values.region, "Ingresa la región."],
    ] as const;
    for (const [field, value, message] of requiredAddressFields) {
      if (!value) {
        context.addIssue({ code: "custom", path: [field], message });
      }
    }
  });

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone ?? "",
    addressLine1: customer.address?.line1 ?? "",
    addressLine2: customer.address?.line2 ?? "",
    commune: customer.address?.commune ?? "",
    city: customer.address?.city ?? "",
    region: customer.address?.region ?? "",
    status: customer.status,
  };
}

export function toCustomerProfileInput(
  values: CustomerFormValues,
): CustomerProfileInput {
  const hasAddress = Boolean(
    values.addressLine1 ||
      values.addressLine2 ||
      values.commune ||
      values.city ||
      values.region,
  );
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone || undefined,
    address: hasAddress
      ? {
          line1: values.addressLine1,
          line2: values.addressLine2 || undefined,
          commune: values.commune,
          city: values.city,
          region: values.region,
        }
      : undefined,
  };
}

export function toStaffCustomerUpdateInput(
  values: CustomerFormValues,
): StaffCustomerUpdateInput {
  return { ...toCustomerProfileInput(values), status: values.status };
}
