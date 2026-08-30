import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock3, MapPin, MessageSquareText, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { tenantBrand } from "@/app/config/brand";
import { PageHeader } from "@/components";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre."),
  email: z.email("Ingresa un correo válido."),
  message: z.string().trim().min(12, "Cuéntanos un poco más para poder ayudarte."),
});

type ContactValues = z.infer<typeof contactSchema>;

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = handleSubmit(async () => {
    setSubmitted(false);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    setSubmitted(true);
    reset();
  });

  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <PageHeader
          eyebrow="Contacto"
          title="Conversemos"
          description="¿Tienes una consulta sobre productos, pedidos o paquetes? Déjanos el contexto y te orientaremos por el canal adecuado."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="space-y-4" aria-label="Información de contacto">
            <Card>
              <CardHeader><CardTitle>Información útil</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="flex gap-3">
                  <MapPin aria-hidden="true" className="mt-0.5 size-5 text-brand-700" />
                  <div><p className="font-semibold">Zona de atención</p><p className="text-sm text-ink-600">{tenantBrand.serviceArea}</p></div>
                </div>
                <div className="flex gap-3">
                  <Clock3 aria-hidden="true" className="mt-0.5 size-5 text-brand-700" />
                  <div><p className="font-semibold">Respuesta</p><p className="text-sm text-ink-600">Los horarios definitivos se confirmarán antes del lanzamiento.</p></div>
                </div>
                <div className="flex gap-3">
                  <MessageSquareText aria-hidden="true" className="mt-0.5 size-5 text-brand-700" />
                  <div><p className="font-semibold">Seguimiento privado</p><p className="text-sm text-ink-600">Ingresa a tu cuenta para consultar pedidos o paquetes propios.</p></div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <Card>
            <CardHeader>
              <CardTitle>Escríbenos</CardTitle>
              <p className="text-sm text-ink-600">Este formulario funciona como demostración y no envía datos a un backend.</p>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <Alert tone="success" role="status" className="mb-5">
                  <MessageSquareText aria-hidden="true" />
                  <p>Mensaje preparado correctamente. La integración de envío se habilitará en una siguiente fase.</p>
                </Alert>
              ) : null}
              <form className="space-y-5" onSubmit={onSubmit} noValidate>
                <div>
                  <Label htmlFor="contact-name">Nombre</Label>
                  <Input id="contact-name" autoComplete="name" aria-describedby={errors.name ? "contact-name-error" : undefined} aria-invalid={Boolean(errors.name)} {...register("name")} />
                  {errors.name ? <p id="contact-name-error" className="mt-1.5 text-sm text-coral-700">{errors.name.message}</p> : null}
                </div>
                <div>
                  <Label htmlFor="contact-email">Correo electrónico</Label>
                  <Input id="contact-email" type="email" autoComplete="email" aria-describedby={errors.email ? "contact-email-error" : undefined} aria-invalid={Boolean(errors.email)} {...register("email")} />
                  {errors.email ? <p id="contact-email-error" className="mt-1.5 text-sm text-coral-700">{errors.email.message}</p> : null}
                </div>
                <div>
                  <Label htmlFor="contact-message">Mensaje</Label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    aria-describedby={errors.message ? "contact-message-error" : undefined}
                    aria-invalid={Boolean(errors.message)}
                    className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-950 shadow-sm placeholder:text-ink-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 aria-[invalid=true]:border-coral-500"
                    {...register("message")}
                  />
                  {errors.message ? <p id="contact-message-error" className="mt-1.5 text-sm text-coral-700">{errors.message.message}</p> : null}
                </div>
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  <Send aria-hidden="true" />
                  {isSubmitting ? "Preparando…" : "Preparar mensaje"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
