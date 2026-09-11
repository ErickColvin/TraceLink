import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Info, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  Label,
} from "@/components/ui";

import { useAuth } from "../context/auth-context";
import {
  resolvePostAuthPath,
  sanitizeInternalPath,
} from "../routing/auth-paths";
import {
  registerSchema,
  type RegisterFormValues,
} from "../schemas/register-schema";
import { normalizeAuthError } from "../services/auth-service";

function FieldError({ id, message }: Readonly<{ id: string; message?: string }>) {
  return message ? (
    <p className="mt-1.5 text-sm text-coral-700" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

export function RegisterPage() {
  const {
    clearError,
    demoSessionsEnabled,
    isPending,
    registerAccount,
    session,
    status,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPath = sanitizeInternalPath(searchParams.get("returnTo"));
  const loginPath = requestedPath
    ? `/login?returnTo=${encodeURIComponent(requestedPath)}`
    : "/login";
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register: registerField,
    resetField,
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  useEffect(() => {
    if (status === "ready" && session.kind !== "anonymous") {
      navigate(resolvePostAuthPath(session, requestedPath), { replace: true });
    }
  }, [navigate, requestedPath, session, status]);

  const onSubmit = handleSubmit(async (values) => {
    clearError();
    clearErrors("root");

    try {
      const nextSession = await registerAccount({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        ...(values.phone ? { phone: values.phone } : {}),
      });
      navigate(resolvePostAuthPath(nextSession, requestedPath), {
        replace: true,
      });
    } catch (submitError: unknown) {
      resetField("password");
      resetField("confirmPassword");
      setError("root", {
        type: "server",
        message: normalizeAuthError(submitError).message,
      });
    }
  });

  const interactionPending =
    status === "loading" || isPending || isSubmitting;
  const submitLabel =
    status === "loading"
      ? "Comprobando sesión…"
      : isPending || isSubmitting
        ? "Creando cuenta…"
        : "Crear cuenta";

  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <PageHeader
          eyebrow="Cuenta de cliente"
          title="Crea tu cuenta"
          description="Regístrate para consultar tus pedidos, paquetes y datos de contacto desde un espacio privado."
        />

        <Card className="mx-auto mt-8 max-w-2xl">
          <CardContent className="space-y-6 pt-5 sm:pt-6">
            <Alert tone="info">
              <Info aria-hidden="true" />
              <AlertTitle>
                {demoSessionsEnabled ? "Modo demostración" : "Registro protegido"}
              </AlertTitle>
              <AlertDescription>
                {demoSessionsEnabled
                  ? "La cuenta abre una sesión temporal y no se conserva al recargar la página."
                  : "Al completar el registro, la API iniciará tu sesión mediante una cookie segura."}
              </AlertDescription>
            </Alert>

            <form className="space-y-6" noValidate onSubmit={onSubmit}>
              <fieldset className="grid gap-5 sm:grid-cols-2" disabled={interactionPending}>
                <legend className="sr-only">Datos de la nueva cuenta</legend>

                <div>
                  <Label htmlFor="register-first-name">Nombre</Label>
                  <Input
                    aria-describedby={
                      errors.firstName ? "register-first-name-error" : undefined
                    }
                    aria-invalid={Boolean(errors.firstName)}
                    autoComplete="given-name"
                    id="register-first-name"
                    {...registerField("firstName")}
                  />
                  <FieldError
                    id="register-first-name-error"
                    message={errors.firstName?.message}
                  />
                </div>

                <div>
                  <Label htmlFor="register-last-name">Apellido</Label>
                  <Input
                    aria-describedby={
                      errors.lastName ? "register-last-name-error" : undefined
                    }
                    aria-invalid={Boolean(errors.lastName)}
                    autoComplete="family-name"
                    id="register-last-name"
                    {...registerField("lastName")}
                  />
                  <FieldError
                    id="register-last-name-error"
                    message={errors.lastName?.message}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="register-email">Correo electrónico</Label>
                  <Input
                    aria-describedby={
                      errors.email ? "register-email-error" : undefined
                    }
                    aria-invalid={Boolean(errors.email)}
                    autoComplete="email"
                    id="register-email"
                    inputMode="email"
                    placeholder="nombre@ejemplo.cl"
                    type="email"
                    {...registerField("email")}
                  />
                  <FieldError
                    id="register-email-error"
                    message={errors.email?.message}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="register-phone">Teléfono (opcional)</Label>
                  <Input
                    aria-describedby={
                      errors.phone ? "register-phone-error" : undefined
                    }
                    aria-invalid={Boolean(errors.phone)}
                    autoComplete="tel"
                    id="register-phone"
                    inputMode="tel"
                    placeholder="+56 9 1234 5678"
                    type="tel"
                    {...registerField("phone")}
                  />
                  <FieldError
                    id="register-phone-error"
                    message={errors.phone?.message}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <span className="text-xs text-ink-600" id="register-password-hint">
                      Mínimo 12 caracteres
                    </span>
                  </div>
                  <Input
                    aria-describedby={
                      errors.password
                        ? "register-password-hint register-password-error"
                        : "register-password-hint"
                    }
                    aria-invalid={Boolean(errors.password)}
                    autoComplete="new-password"
                    id="register-password"
                    type="password"
                    {...registerField("password")}
                  />
                  <FieldError
                    id="register-password-error"
                    message={errors.password?.message}
                  />
                </div>

                <div>
                  <Label htmlFor="register-password-confirmation">
                    Confirmar contraseña
                  </Label>
                  <Input
                    aria-describedby={
                      errors.confirmPassword
                        ? "register-password-confirmation-error"
                        : undefined
                    }
                    aria-invalid={Boolean(errors.confirmPassword)}
                    autoComplete="new-password"
                    id="register-password-confirmation"
                    type="password"
                    {...registerField("confirmPassword")}
                  />
                  <FieldError
                    id="register-password-confirmation-error"
                    message={errors.confirmPassword?.message}
                  />
                </div>
              </fieldset>

              {errors.root ? (
                <Alert aria-live="polite" role="alert" tone="danger">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>No fue posible crear la cuenta</AlertTitle>
                  <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                aria-busy={interactionPending}
                className="w-full"
                disabled={interactionPending}
                size="lg"
                type="submit"
              >
                <UserPlus aria-hidden="true" />
                {submitLabel}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center bg-ink-50 text-sm text-ink-600">
            ¿Ya tienes una cuenta?{" "}
            <Link className="ml-1 font-bold text-brand-700 hover:text-brand-800" to={loginPath}>
              Inicia sesión
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
