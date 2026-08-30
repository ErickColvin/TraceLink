import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useAuth } from "@/features/auth";

export function CustomerProfilePage() {
  const { session } = useAuth();
  const customer = session.kind === "customer" ? session.customer : null;

  return (
    <div>
      <PageHeader eyebrow="Cuenta" title="Mi perfil" description="Información básica asociada a la identidad autenticada." />
      <Alert tone="info" className="mt-6"><ShieldCheck aria-hidden="true" /><p>Esta vista no permite buscar datos de otras personas. La API futura validará la propiedad de cada registro.</p></Alert>
      <Card className="mt-6 max-w-2xl"><CardHeader><CardTitle>Datos personales</CardTitle></CardHeader><CardContent className="space-y-5">{customer ? <><div className="flex gap-3"><UserRound aria-hidden="true" className="mt-0.5 size-5 text-brand-700" /><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Nombre</p><p className="mt-1 font-semibold">{customer.firstName} {customer.lastName}</p></div></div><div className="flex gap-3"><Mail aria-hidden="true" className="mt-0.5 size-5 text-brand-700" /><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">Correo</p><p className="mt-1 font-semibold">{customer.email}</p></div></div></> : null}<p className="border-t border-ink-100 pt-5 text-sm leading-6 text-ink-600">La edición de perfil se conectará al servicio de clientes cuando exista autenticación real.</p></CardContent></Card>
    </div>
  );
}

