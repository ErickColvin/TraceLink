import { Construction } from "lucide-react";
import { EmptyState, PageHeader } from "@/components";

type AdminComingSoonPageProps = {
  title: string;
  description: string;
};

export function AdminComingSoonPage({ description, title }: AdminComingSoonPageProps) {
  return (
    <div>
      <PageHeader eyebrow="Arquitectura preparada" title={title} description={description} />
      <EmptyState className="mt-7" icon={<Construction />} title="Módulo preparado para una siguiente fase" description="El shell, la ruta y los permisos ya están definidos. La lógica operacional se implementará cuando entre en el alcance del milestone." />
    </div>
  );
}

