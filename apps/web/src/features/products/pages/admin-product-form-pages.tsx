import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState, LoadingSkeleton, PageHeader } from "@/components";
import { Button, buttonStyles } from "@/components/ui";
import { useHasPermission } from "@/features/auth";

import { ProductForm } from "../components/product-form";
import {
  useCreateProduct,
  useProductById,
  useProductCategories,
  useUpdateProduct,
} from "../queries/product-queries";
import {
  EMPTY_PRODUCT_FORM_VALUES,
  productToFormValues,
  toProductCommercialInput,
  type ProductFormValues,
} from "../schemas/product-form-schema";

function getMutationError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No pudimos guardar el producto. Revisa los datos e intÃ©ntalo nuevamente.";
}

function ProductFormLoading() {
  return (
    <div aria-label="Cargando formulario de producto" className="space-y-5">
      <LoadingSkeleton className="h-52 rounded-2xl" />
      <LoadingSkeleton className="h-52 rounded-2xl" />
      <LoadingSkeleton className="h-44 rounded-2xl" />
    </div>
  );
}

function PermissionDenied({ action }: Readonly<{ action: string }>) {
  return (
    <ErrorState
      title="No tienes permiso para esta acciÃ³n"
      description={`Tu perfil no permite ${action} productos.`}
      action={
        <Link className={buttonStyles({ variant: "outline" })} to="/app/products">
          Volver a productos
        </Link>
      }
    />
  );
}

export function AdminProductCreatePage() {
  const canCreate = useHasPermission("products.create");
  const navigate = useNavigate();
  const categoriesQuery = useProductCategories();
  const createMutation = useCreateProduct();
  const [errorMessage, setErrorMessage] = useState("");

  if (!canCreate) return <PermissionDenied action="crear" />;

  const submit = async (values: ProductFormValues) => {
    setErrorMessage("");
    try {
      const created = await createMutation.mutateAsync(
        toProductCommercialInput(values),
      );
      navigate(`/app/products/${created.id}`, {
        replace: true,
        state: { notice: "Producto creado correctamente." },
      });
    } catch (error) {
      setErrorMessage(getMutationError(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CatÃ¡logo operativo"
        title="Nuevo producto"
        description="Registra informaciÃ³n comercial. El producto iniciarÃ¡ con stock disponible 0 hasta que Inventario reciba un movimiento."
        actions={
          <Link
            className={buttonStyles({ variant: "outline" })}
            to="/app/products"
          >
            <ArrowLeft aria-hidden="true" /> Volver
          </Link>
        }
      />

      {categoriesQuery.isPending ? <ProductFormLoading /> : null}
      {categoriesQuery.isError ? (
        <ErrorState
          title="No pudimos preparar el formulario"
          description="Las categorÃ­as son necesarias para crear un producto."
          action={<Button onClick={() => void categoriesQuery.refetch()}>Reintentar</Button>}
        />
      ) : null}
      {categoriesQuery.data ? (
        <ProductForm
          categories={categoriesQuery.data}
          defaultValues={EMPTY_PRODUCT_FORM_VALUES}
          errorMessage={errorMessage}
          pending={createMutation.isPending}
          submitLabel="Crear producto"
          onSubmit={submit}
        />
      ) : null}
    </div>
  );
}

export function AdminProductEditPage() {
  const canUpdate = useHasPermission("products.update");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productQuery = useProductById(id);
  const categoriesQuery = useProductCategories();
  const updateMutation = useUpdateProduct();
  const [errorMessage, setErrorMessage] = useState("");

  if (!canUpdate) return <PermissionDenied action="editar" />;

  const submit = async (values: ProductFormValues) => {
    if (!id) return;
    setErrorMessage("");
    try {
      const updated = await updateMutation.mutateAsync({
        id,
        input: toProductCommercialInput(values),
      });
      navigate(`/app/products/${updated.id}`, {
        replace: true,
        state: { notice: "Cambios guardados correctamente." },
      });
    } catch (error) {
      setErrorMessage(getMutationError(error));
    }
  };

  const isPending = productQuery.isPending || categoriesQuery.isPending;
  const isError = productQuery.isError || categoriesQuery.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CatÃ¡logo operativo"
        title="Editar producto"
        description="Actualiza datos comerciales sin alterar existencias."
        actions={
          <Link
            className={buttonStyles({ variant: "outline" })}
            to={id ? `/app/products/${id}` : "/app/products"}
          >
            <ArrowLeft aria-hidden="true" /> Volver
          </Link>
        }
      />

      {isPending ? <ProductFormLoading /> : null}
      {isError ? (
        <ErrorState
          title="No pudimos cargar el producto"
          description="Puede que ya no exista o que la informaciÃ³n no estÃ© disponible."
          action={
            <Button
              onClick={() => {
                void productQuery.refetch();
                void categoriesQuery.refetch();
              }}
            >
              Reintentar
            </Button>
          }
        />
      ) : null}
      {productQuery.data && categoriesQuery.data ? (
        <ProductForm
          key={productQuery.data.id}
          categories={categoriesQuery.data}
          defaultValues={productToFormValues(productQuery.data)}
          errorMessage={errorMessage}
          pending={updateMutation.isPending}
          submitLabel="Guardar cambios"
          onSubmit={submit}
        />
      ) : null}
    </div>
  );
}
