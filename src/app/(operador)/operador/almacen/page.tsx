import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ALLOWED_ROLES = ["warehouse", "admin", "superadmin"];

export default async function AlmacenPage() {
  const user = await requireUser();

  if (!ALLOWED_ROLES.includes(user.role)) {
    redirect("/operador");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-1">Almacén</h1>
      <p className="text-sm text-stone-400 mb-8">
        Gestión de sitios, proveedores, recepciones y lotes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card aria-disabled className="p-5 flex flex-col gap-3 opacity-75">
          <div>
            <p className="font-medium text-stone-900 text-sm">Sitios</p>
            <p className="text-xs text-stone-400 mt-1">
              Cocinas y depósitos de la organización.
            </p>
          </div>
          <div>
            <Badge variant="default">Próximamente</Badge>
          </div>
        </Card>

        <Card aria-disabled className="p-5 flex flex-col gap-3 opacity-75">
          <div>
            <p className="font-medium text-stone-900 text-sm">Proveedores</p>
            <p className="text-xs text-stone-400 mt-1">
              Catálogo de proveedores de insumos.
            </p>
          </div>
          <div>
            <Badge variant="default">Próximamente</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
