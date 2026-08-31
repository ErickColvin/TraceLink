import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { tenantBrand } from "@/app/config/brand";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "../context/auth-context";
import type { AuthAudience } from "../model/auth";
import {
  resolvePostAuthPath,
  sanitizeInternalPath,
} from "../routing/auth-paths";
import {
  signInSchema,
  type SignInFormValues,
} from "../schemas/sign-in-schema";
import { normalizeAuthError } from "../services/auth-service";

const audienceOptions: ReadonlyArray<{
  value: AuthAudience;
  label: string;
  description: string;
}> = [
  {
    value: "customer",
    label: "Cliente",
    description: "Pedidos, paquetes y perfil",
  },
  {
    value: "staff",
    label: "Personal autorizado",
    description: "Operación y administración",
  },
];

export function LoginPage() {
  const {
    session,
    status,
    isPending,
    signIn,
    startDemoSession,
    clearError,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeDemo, setActiveDemo] = useState<AuthAudience | null>(null);
  const requestedPath = sanitizeInternalPath(searchParams.get("returnTo"));
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      audience: "customer",
      email: "",
      password: "",
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
      const nextSession = await signIn(values);
      navigate(resolvePostAuthPath(nextSession, requestedPath), {
        replace: true,
      });
    } catch (submitError: unknown) {
      resetField("password");
      setError("root", {
        type: "server",
        message: normalizeAuthError(submitError).message,
      });
    }
  });

  const enterDemo = async (audience: AuthAudience) => {
    clearError();
    clearErrors("root");
    setActiveDemo(audience);

    try {
      const nextSession = await startDemoSession(audience);
      navigate(resolvePostAuthPath(nextSession, requestedPath), {
        replace: true,
      });
    } catch (demoError: unknown) {
      setError("root", {
        type: "server",
        message: normalizeAuthError(demoError).message,
      });
    } finally {
      setActiveDemo(null);
    }
  };

  const interactionPending =
    status === "loading" || isPending || isSubmitting || activeDemo !== null;

  return (
    <main tabIndex={-1} className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-ice-50 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-40 border-b border-ice-200 bg-white/70"
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_minmax(0,32rem)] lg:gap-16">
        <section
          aria-labelledby="login-introduction"
          className="hidden lg:block"
        >
          <Link
            className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4"
            to="/"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm">
              {tenantBrand.shortName}
            </span>
            <span>
              <span className="block text-lg font-semibold text-ink-950">
                {tenantBrand.name}
              </span>
              <span className="block text-sm text-ink-600">
                Comercio y trazabilidad
              </span>
            </span>
          </Link>

          <p className="mt-14 text-sm font-semibold uppercase tracking-widest text-brand-700">
            Todo bajo control
          </p>
          <h2
            className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-ink-950 xl:text-5xl"
            id="login-introduction"
          >
            Tus pedidos y operaciones, en un solo lugar.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-ink-600">
            Revisa el avance de tus compras y paquetes, o gestiona la operación
            diaria con una experiencia clara y segura.
          </p>

          <ul className="mt-10 grid max-w-lg gap-4" role="list">
            {[
              "Información asociada a tu cuenta autenticada",
              "Seguimiento claro de pedidos y paquetes",
              "Accesos diferenciados para clientes y personal",
            ].map((benefit, index) => (
              <li className="flex items-center gap-4" key={benefit}>
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
                >
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-ink-950">
                  {benefit}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Card className="w-full shadow-lg">
          <CardHeader className="space-y-4">
            <Link
              className="inline-flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4 lg:hidden"
              to="/"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
                {tenantBrand.shortName}
              </span>
              <span className="font-semibold">{tenantBrand.name}</span>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-ink-950">
                Inicia sesión
              </h1>
              <CardDescription className="mt-2">
                Elige tu tipo de acceso e ingresa tus datos.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert tone="info">
              <Info aria-hidden="true" />
              <AlertTitle>Autenticación real en preparación</AlertTitle>
              <AlertDescription>
                El formulario ya valida tus datos, pero todavía no los envía a
                un servidor. Para recorrer la plataforma, usa uno de los accesos
                de demostración.
              </AlertDescription>
            </Alert>

            <form className="space-y-5" noValidate onSubmit={onSubmit}>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink-950">
                  Tipo de acceso
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {audienceOptions.map((option) => (
                    <label
                      className="relative flex cursor-pointer gap-3 rounded-xl border border-ink-200 bg-white p-3 transition-colors has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-2"
                      key={option.value}
                    >
                      <input
                        className="mt-1 size-4 accent-brand-600"
                        type="radio"
                        value={option.value}
                        {...register("audience")}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-ink-950">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-ink-600">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  aria-describedby={errors.email ? "email-error" : undefined}
                  aria-invalid={errors.email ? "true" : "false"}
                  autoComplete="email"
                  id="email"
                  inputMode="email"
                  placeholder="nombre@ejemplo.cl"
                  type="email"
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="text-sm text-coral-700" id="email-error">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="password">Contraseña</Label>
                  <span className="text-xs text-ink-600" id="password-hint">
                    Mínimo 8 caracteres
                  </span>
                </div>
                <Input
                  aria-describedby={
                    errors.password
                      ? "password-hint password-error"
                      : "password-hint"
                  }
                  aria-invalid={errors.password ? "true" : "false"}
                  autoComplete="current-password"
                  id="password"
                  type="password"
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-sm text-coral-700" id="password-error">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              {errors.root ? (
                <Alert aria-live="polite" tone="danger">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>No fue posible iniciar sesión</AlertTitle>
                  <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                className="w-full"
                disabled={interactionPending}
                size="lg"
                type="submit"
              >
                {isSubmitting ? "Validando…" : "Iniciar sesión"}
              </Button>
            </form>

            <div className="relative py-1" role="separator">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-ink-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs font-medium uppercase tracking-wide text-ink-600">
                  Explorar demostración
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                disabled={interactionPending}
                onClick={() => void enterDemo("customer")}
                type="button"
                variant="outline"
              >
                {activeDemo === "customer"
                  ? "Abriendo…"
                  : "Entrar como cliente"}
              </Button>
              <Button
                disabled={interactionPending}
                onClick={() => void enterDemo("staff")}
                type="button"
                variant="outline"
              >
                {activeDemo === "staff"
                  ? "Abriendo…"
                  : "Entrar como personal"}
              </Button>
            </div>
          </CardContent>

          <CardFooter className="bg-ink-50">
            <p className="text-xs leading-5 text-ink-600">
              Los accesos demo no usan credenciales y su sesión vive únicamente
              en memoria. No ingreses una contraseña real en este entorno.
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
