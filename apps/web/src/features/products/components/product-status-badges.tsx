import { Badge } from "@/components/ui";

import type { Product } from "../domain";

export function ProductStatusBadges({
  product,
}: Readonly<{ product: Pick<Product, "active" | "published"> }>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone={product.published ? "success" : "neutral"}>
        {product.published ? "Publicado" : "No publicado"}
      </Badge>
      <Badge tone={product.active ? "brand" : "danger"}>
        {product.active ? "Activo" : "Inactivo"}
      </Badge>
    </div>
  );
}
