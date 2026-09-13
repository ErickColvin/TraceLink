import { FileClock } from "lucide-react";

import { PageHeader } from "@/components";
import { Alert, Card, CardContent } from "@/components/ui";

function LegalPlaceholderPage({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <div className="bg-ice-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <PageHeader
          eyebrow="Información legal"
          title={title}
          description={description}
        />
        <Card className="mt-8">
          <CardContent className="py-8">
            <Alert tone="warning">
              <FileClock aria-hidden="true" />
              <p className="font-bold">PENDIENTE DE APROBACIÓN</p>
              <p className="mt-1">
                El contenido jurídico definitivo debe ser proporcionado y aprobado por CH Market antes de publicar el sitio como comercio operativo.
              </p>
            </Alert>
            <p className="mt-6 text-sm leading-7 text-ink-600">
              Esta página reserva la ruta y la navegación necesarias, pero no presenta condiciones ni políticas inventadas como si fueran definitivas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalPlaceholderPage
      title="Términos y condiciones"
      description="Condiciones aplicables a la compra y uso de CH Market."
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalPlaceholderPage
      title="Privacidad"
      description="Información sobre tratamiento y protección de datos personales."
    />
  );
}

export function ReturnsPage() {
  return (
    <LegalPlaceholderPage
      title="Cambios y devoluciones"
      description="Condiciones para solicitudes, cambios, cancelaciones y devoluciones."
    />
  );
}
