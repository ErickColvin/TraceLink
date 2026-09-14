import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon, Save, Warehouse } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";

import type { ProductCategory } from "../domain";
import {
  productFormSchema,
  type ProductFormValues,
} from "../schemas/product-form-schema";

const selectClassName =
  "h-11 w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60 aria-[invalid=true]:border-coral-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-coral-100";
const textareaClassName =
  "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm placeholder:text-ink-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60 aria-[invalid=true]:border-coral-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-coral-100";

export type ProductFormProps = Readonly<{
  categories: readonly ProductCategory[];
  defaultValues: ProductFormValues;
  errorMessage?: string;
  pending: boolean;
  submitLabel: string;
  onSubmit(values: ProductFormValues): Promise<void>;
}>;

function FieldError({
  id,
  message,
}: Readonly<{ id: string; message?: string }>) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-sm text-coral-700" id={id}>
      {message}
    </p>
  );
}

export function ProductForm({
  categories,
  defaultValues,
  errorMessage,
  pending,
  submitLabel,
  onSubmit,
}: ProductFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<ProductFormValues>({
    defaultValues,
    resolver: zodResolver(productFormSchema),
  });
  const isActive = useWatch({ control, name: "active" });

  useEffect(() => {
    if (!isActive) setValue("published", false, { shouldDirty: true });
  }, [isActive, setValue]);

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      {errorMessage ? (
        <Alert tone="danger">
          <p>{errorMessage}</p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identificación comercial</CardTitle>
          <p className="text-sm text-ink-600">
            Estos datos identifican el producto en operaciones y en la tienda.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="product-sku">SKU</Label>
            <Input
              id="product-sku"
              autoComplete="off"
              aria-describedby={errors.sku ? "product-sku-error" : undefined}
              aria-invalid={Boolean(errors.sku)}
              {...register("sku")}
            />
            <FieldError id="product-sku-error" message={errors.sku?.message} />
          </div>
          <div>
            <Label htmlFor="product-barcode">Barcode (opcional)</Label>
            <Input
              id="product-barcode"
              inputMode="numeric"
              autoComplete="off"
              aria-describedby={errors.barcode ? "product-barcode-error" : undefined}
              aria-invalid={Boolean(errors.barcode)}
              {...register("barcode")}
            />
            <FieldError id="product-barcode-error" message={errors.barcode?.message} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="product-name">Nombre</Label>
            <Input
              id="product-name"
              aria-describedby={errors.name ? "product-name-error" : undefined}
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            <FieldError id="product-name-error" message={errors.name?.message} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="product-slug">Slug</Label>
            <Input
              id="product-slug"
              autoComplete="off"
              placeholder="nombre-del-producto"
              aria-describedby={errors.slug ? "product-slug-error" : "product-slug-help"}
              aria-invalid={Boolean(errors.slug)}
              {...register("slug")}
            />
            <p className="mt-1.5 text-xs text-ink-500" id="product-slug-help">
              Se usará en la URL pública. Solo minúsculas, números y guiones.
            </p>
            <FieldError id="product-slug-error" message={errors.slug?.message} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="product-description">Descripción (opcional)</Label>
            <textarea
              className={textareaClassName}
              id="product-description"
              rows={5}
              aria-describedby={errors.description ? "product-description-error" : undefined}
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            <FieldError
              id="product-description-error"
              message={errors.description?.message}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clasificación y precio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="product-brand">Marca (opcional)</Label>
            <Input
              id="product-brand"
              aria-describedby={errors.brand ? "product-brand-error" : undefined}
              aria-invalid={Boolean(errors.brand)}
              {...register("brand")}
            />
            <FieldError id="product-brand-error" message={errors.brand?.message} />
          </div>
          <div>
            <Label htmlFor="product-category">Categoría</Label>
            <select
              className={selectClassName}
              id="product-category"
              aria-describedby={errors.categoryId ? "product-category-error" : undefined}
              aria-invalid={Boolean(errors.categoryId)}
              {...register("categoryId")}
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <FieldError id="product-category-error" message={errors.categoryId?.message} />
          </div>
          <div>
            <Label htmlFor="product-price">Precio de venta (CLP)</Label>
            <Input
              id="product-price"
              inputMode="numeric"
              min={1}
              step={1}
              type="number"
              aria-describedby={errors.salePrice ? "product-price-error" : undefined}
              aria-invalid={Boolean(errors.salePrice)}
              {...register("salePrice", { valueAsNumber: true })}
            />
            <FieldError id="product-price-error" message={errors.salePrice?.message} />
          </div>
          <div>
            <Label htmlFor="product-minimum-stock">Stock mínimo</Label>
            <Input
              id="product-minimum-stock"
              inputMode="numeric"
              min={0}
              step={1}
              type="number"
              aria-describedby={
                errors.minimumStock
                  ? "product-minimum-stock-error"
                  : "product-minimum-stock-help"
              }
              aria-invalid={Boolean(errors.minimumStock)}
              {...register("minimumStock", { valueAsNumber: true })}
            />
            <p className="mt-1.5 text-xs text-ink-500" id="product-minimum-stock-help">
              Define el umbral de alerta; no modifica existencias.
            </p>
            <FieldError
              id="product-minimum-stock-error"
              message={errors.minimumStock?.message}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imagen y visibilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="product-image">URL de imagen (opcional)</Label>
            <div className="relative">
              <ImageIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              />
              <Input
                className="pl-10"
                id="product-image"
                type="url"
                aria-describedby={errors.imageUrl ? "product-image-error" : undefined}
                aria-invalid={Boolean(errors.imageUrl)}
                {...register("imageUrl")}
              />
            </div>
            <FieldError id="product-image-error" message={errors.imageUrl?.message} />
          </div>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-ink-900">
              Estado inicial
            </legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 p-4">
              <input
                className="mt-0.5 size-4 accent-brand-700"
                type="checkbox"
                {...register("active")}
              />
              <span>
                <span className="block text-sm font-semibold text-ink-950">Activo</span>
                <span className="mt-0.5 block text-xs text-ink-600">
                  Disponible para la operación interna.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 p-4 has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-ink-50">
              <input
                className="mt-0.5 size-4 accent-brand-700"
                disabled={!isActive}
                type="checkbox"
                {...register("published")}
              />
              <span>
                <span className="block text-sm font-semibold text-ink-950">Publicado</span>
                <span className="mt-0.5 block text-xs text-ink-600">
                  Visible en la tienda solo mientras esté activo.
                </span>
              </span>
            </label>
          </fieldset>

          <Alert tone="info">
            <Warehouse aria-hidden="true" />
            <p>
              El stock disponible no se edita aquí. Las existencias se actualizan
              exclusivamente mediante movimientos de inventario con trazabilidad.
            </p>
          </Alert>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button disabled={pending} size="lg" type="submit">
          <Save aria-hidden="true" />
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
