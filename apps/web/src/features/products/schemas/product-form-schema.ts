import { z } from "zod";

import type { Product, ProductCommercialInput } from "../domain";

const optionalText = z.string().trim().max(500);

export const productFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(3, "Ingresa un SKU de al menos 3 caracteres.")
    .max(40, "El SKU no puede superar 40 caracteres.")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
      "Usa solo letras, nÃºmeros, punto, guion o guion bajo.",
    ),
  barcode: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\d{8,14}$/, "El cÃ³digo debe contener entre 8 y 14 dÃ­gitos."),
  ]),
  name: z
    .string()
    .trim()
    .min(3, "Ingresa un nombre de al menos 3 caracteres.")
    .max(140, "El nombre no puede superar 140 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Ingresa un slug de al menos 3 caracteres.")
    .max(160, "El slug no puede superar 160 caracteres.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usa minÃºsculas, nÃºmeros y guiones simples.",
    ),
  description: optionalText,
  brand: z.string().trim().max(80, "La marca no puede superar 80 caracteres."),
  categoryId: z.string().trim().min(1, "Selecciona una categorÃ­a."),
  salePrice: z
    .number({ error: "Ingresa un precio vÃ¡lido." })
    .int("El precio debe expresarse en pesos enteros.")
    .positive("El precio debe ser mayor que cero."),
  minimumStock: z
    .number({ error: "Ingresa un stock mÃ­nimo vÃ¡lido." })
    .int("El stock mÃ­nimo debe ser un entero.")
    .min(0, "El stock mÃ­nimo no puede ser negativo."),
  imageUrl: z.union([
    z.literal(""),
    z.url("Ingresa una URL de imagen vÃ¡lida."),
  ]),
  published: z.boolean(),
  active: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const EMPTY_PRODUCT_FORM_VALUES: ProductFormValues = {
  sku: "",
  barcode: "",
  name: "",
  slug: "",
  description: "",
  brand: "",
  categoryId: "",
  salePrice: 0,
  minimumStock: 0,
  imageUrl: "",
  published: false,
  active: true,
};

export function productToFormValues(product: Product): ProductFormValues {
  return {
    sku: product.sku,
    barcode: product.barcode ?? "",
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    brand: product.brand ?? "",
    categoryId: product.categoryId,
    salePrice: product.salePrice,
    minimumStock: product.minimumStock ?? 0,
    imageUrl: product.imageUrl ?? "",
    published: product.published,
    active: product.active,
  };
}

export function toProductCommercialInput(
  values: ProductFormValues,
): ProductCommercialInput {
  return {
    sku: values.sku,
    barcode: values.barcode || undefined,
    name: values.name,
    slug: values.slug,
    description: values.description || undefined,
    brand: values.brand || undefined,
    categoryId: values.categoryId,
    salePrice: values.salePrice,
    minimumStock: values.minimumStock,
    imageUrl: values.imageUrl || undefined,
    published: values.published,
    active: values.active,
  };
}
